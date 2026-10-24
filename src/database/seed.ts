import "dotenv/config";
import * as bcrypt from "bcrypt";
import mongoose from "mongoose";
import { CompanyKey, EmployeeStatus, Role } from "../common/enums/role.enum";
import { EmployeesService } from "../employees/employees.service";
import { Employee, EmployeeSchema } from "../employees/schemas/employee.schema";

async function seed() {
  const uri = process.env.MONGO_URL_SCRAPPING;
  const dbName = process.env.MONGO_DBNAME_SCRAPPING || "spark_erp";
  if (!uri) throw new Error("MONGO_URL_SCRAPPING is required");
  await mongoose.connect(uri, { dbName });
  const EmployeeModel = mongoose.model(Employee.name, EmployeeSchema);
  const phone = EmployeesService.normalizePhone("555765446");
  const passwordHash = await bcrypt.hash("123123", 12);
  await EmployeeModel.findOneAndUpdate(
    { phone },
    {
      $set: {
        fullName: "مدير النظام",
        phone,
        passwordHash,
        role: Role.SUPER_ADMIN,
        company: null,
        department: "الإدارة العامة",
        jobTitle: "مدير النظام",
        status: EmployeeStatus.ACTIVE,
        deletedAt: null
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await mongoose.disconnect();
  process.stdout.write("تم تجهيز قاعدة البيانات وحساب مدير النظام بنجاح.\n");
}

seed().catch(async (error) => {
  process.stderr.write(`فشل تجهيز قاعدة البيانات: ${error instanceof Error ? error.message : "خطأ غير معروف"}\n`);
  await mongoose.disconnect();
  process.exit(1);
});
