import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Response } from "express";
import { GridFSBucket, GridFSFile } from "mongodb";
import { Connection, Types } from "mongoose";
import { Readable } from "stream";

export type DeliveryAttachmentKind = "image" | "video" | "audio" | "document" | "archive" | "file";

export type DeliveryUpload = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type StoredDeliveryAttachment = {
  storageId: string;
  name: string;
  mimeType: string;
  size: number;
  kind: DeliveryAttachmentKind;
  url: string;
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg", "audio/aac", "audio/x-m4a",
  "application/pdf", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip", "application/x-7z-compressed", "application/x-rar-compressed"
]);

@Injectable()
export class DeliveryFilesService {
  private readonly bucket: GridFSBucket;

  constructor(@InjectConnection() connection: Connection) {
    if (!connection.db) throw new Error("MongoDB connection is not ready");
    this.bucket = new GridFSBucket(connection.db, { bucketName: "deliveryFiles" });
  }

  validate(files: DeliveryUpload[]) {
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > 120 * 1024 * 1024) throw new BadRequestException("إجمالي المرفقات في التسليم الواحد يجب ألا يتجاوز 120 ميجابايت");
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) throw new BadRequestException(`نوع الملف غير مدعوم: ${file.originalname}`);
    }
  }

  async storeMany(files: DeliveryUpload[], authorId: string): Promise<StoredDeliveryAttachment[]> {
    this.validate(files);
    const stored: StoredDeliveryAttachment[] = [];
    try {
      for (const file of files) stored.push(await this.store(file, authorId));
      return stored;
    } catch (error) {
      await this.removeMany(stored.map((attachment) => attachment.storageId));
      throw error;
    }
  }

  async removeMany(ids: string[]) {
    await Promise.all(ids.filter(Types.ObjectId.isValid).map(async (id) => {
      try { await this.bucket.delete(new Types.ObjectId(id)); } catch { /* already absent */ }
    }));
  }

  async send(fileId: string, response: Response, range?: string, download = false) {
    if (!Types.ObjectId.isValid(fileId)) throw new NotFoundException("الملف غير موجود");
    const id = new Types.ObjectId(fileId);
    const file = await this.bucket.find({ _id: id }).next() as GridFSFile | null;
    if (!file) throw new NotFoundException("الملف غير موجود");

    const mimeType = String(file.metadata?.mimeType || "application/octet-stream");
    const safeName = String(file.metadata?.originalName || file.filename || "attachment").replace(/[\r\n"]/g, "_");
    response.setHeader("Content-Type", mimeType);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(safeName)}`);

    let start = 0;
    let end = file.length - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        start = match[1] ? Number(match[1]) : 0;
        end = match[2] ? Math.min(Number(match[2]), file.length - 1) : file.length - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= file.length) {
          response.status(416).setHeader("Content-Range", `bytes */${file.length}`).end();
          return;
        }
        response.status(206);
        response.setHeader("Content-Range", `bytes ${start}-${end}/${file.length}`);
      }
    }
    response.setHeader("Content-Length", end - start + 1);
    this.bucket.openDownloadStream(id, { start, end: end + 1 }).on("error", () => {
      if (!response.headersSent) response.status(404);
      response.end();
    }).pipe(response);
  }

  private async store(file: DeliveryUpload, authorId: string): Promise<StoredDeliveryAttachment> {
    const name = this.safeFilename(file.originalname);
    const kind = this.kindFromMime(file.mimetype);
    const stream = this.bucket.openUploadStream(name, { metadata: { originalName: name, mimeType: file.mimetype, size: file.size, kind, authorId } });
    await new Promise<void>((resolve, reject) => Readable.from([file.buffer]).pipe(stream).once("finish", () => resolve()).once("error", reject));
    const storageId = String(stream.id);
    return { storageId, name, mimeType: file.mimetype, size: file.size, kind, url: `/deliveries/files/${storageId}` };
  }

  private safeFilename(name: string) {
    const clean = name.normalize("NFKC").replace(/[\\/:*?"<>|\x00-\x1F]/g, "_").trim();
    return (clean || "attachment").slice(-180);
  }

  private kindFromMime(mime: string): DeliveryAttachmentKind {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z")) return "archive";
    if (mime === "application/pdf" || mime.startsWith("text/") || mime.includes("word") || mime.includes("sheet") || mime.includes("excel") || mime.includes("presentation") || mime.includes("powerpoint")) return "document";
    return "file";
  }
}
