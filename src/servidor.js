import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import routes from "./routes.js"; // suas rotas principais

dotenv.config();

const app = express();

// Configurações de diretórios
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pasta pública (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "../public")));

// 🔹 Redirecionamento padrão da raiz
app.get("/", (req, res) => {
  res.redirect("/admin.html"); // altere para '/cozinha.html' se preferir
});

// Rotas da API
app.use("/api", routes);

// Tratamento de erro 404 para rotas inexistentes
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Porta (Railway define automaticamente process.env.PORT)
const PORT = process.env.PORT || 3333;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || "development"}`);
});

export default app;
