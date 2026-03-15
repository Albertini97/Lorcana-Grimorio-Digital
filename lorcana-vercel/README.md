# 🌟 Lorcana Companion — Grimorio Digital

Aplicación completa para el TCG Disney Lorcana: catálogo de cartas, escáner con IA, colección personal y gestión de mazos.

## 🚀 Desplegar en Vercel

### Paso 1 — Sube el proyecto a GitHub

```bash
git init
git add .
git commit -m "Lorcana Companion v1"
git remote add origin https://github.com/TU_USUARIO/lorcana-companion.git
git push -u origin main
```

### Paso 2 — Conecta con Vercel

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Importa tu repositorio de GitHub
3. En configuración: Framework = **Other**, Root = `/`
4. Haz clic en **Deploy**

### Paso 3 — Añade tu API Key de Anthropic

En el dashboard de Vercel, ve a tu proyecto:
**Settings → Environment Variables** y añade:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (tu API key) |

Consigue tu key en: https://console.anthropic.com/settings/keys

Después haz **Redeploy** para aplicar la variable.

---

## 📁 Estructura del proyecto

```
lorcana-companion/
├── api/
│   └── scan.js          ← Backend seguro (Edge Function)
├── public/
│   └── index.html       ← La app completa
├── vercel.json          ← Configuración de rutas
├── package.json
└── README.md
```

## ✨ Funcionalidades

- 📚 **Catálogo completo** — todos los sets de Lorcana con búsqueda y filtros
- 📷 **Escáner IA** — identifica cartas con la cámara o subiendo una foto
- ⭐ **Colección** — estadísticas, valor estimado, progreso por set
- 🃏 **Mazos** — crea y gestiona mazos con hasta 60 cartas
- ⬆⬇ **Export/Import** — JSON, CSV, texto plano
- ☁ **Modo offline** — funciona sin conexión a la API de cartas

## 🔒 Seguridad

La API key de Anthropic nunca se expone en el frontend. Todas las llamadas a Claude se hacen a través de `/api/scan` (Edge Function en Vercel), que inyecta la key desde las variables de entorno del servidor.

## 🛠 Desarrollo local

```bash
npm install -g vercel
vercel dev
```

Crea un archivo `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```
