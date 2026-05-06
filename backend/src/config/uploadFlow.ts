import path from "path";
import fs from "fs";
import multer from "multer";
import AppError from "../errors/AppError";

const publicFolder = path.resolve(__dirname, "..", "..", "public");
const flowMediaFolder = path.resolve(publicFolder, "flow-media");

const ensureFolder = (folder: string): void => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
};

ensureFolder(flowMediaFolder);

const sanitizeFileName = (name: string): string => {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_");
};

const uploadFlow = multer({
  storage: multer.diskStorage({
    destination: (req: any, _file, cb) => {
      const companyId = Number(req?.user?.companyId || 0);
      const companyFolder = path.resolve(flowMediaFolder, `${companyId || "global"}`);
      ensureFolder(companyFolder);
      cb(null, companyFolder);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const base = path.basename(file.originalname || "anexo", ext);
      const stamp = Date.now();
      cb(null, `${stamp}_${sanitizeFileName(base)}${ext}`);
    }
  }),
  limits: {
    fileSize: 40 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const mimetype = String(file?.mimetype || "").toLowerCase();
    if (mimetype.startsWith("image/") || mimetype.startsWith("video/")) {
      cb(null, true);
      return;
    }

    cb(new AppError("Apenas arquivos de imagem ou video sao permitidos.", 400) as any, false);
  }
});

export default uploadFlow;
