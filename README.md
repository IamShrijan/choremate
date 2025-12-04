# choremate
Making household chores collaborative, fair, and actually enjoyable for shared living spaces

## 🚀 Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- npm or yarn

---

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/prashanthjaganathan/choremate.git
   cd choremate
   ```

   2. **Create and activate a virtual environment**
   ```
   cd backend
   python -m venv .venv
   
   # On macOS/Linux:
   source .venv/bin/activate
   
   # On Windows:
   .venv\Scripts\activate
   ```

   3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

   4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (add GEMINI_API_KEY)
   ```

   5. **Initialize the database**
   ```bash
   python create_db.py
   ```

   6. **Run the FastAPI application**
   ```bash
   uvicorn app.main:app --reload
   ```
   The API will be available at `http://localhost:8000`
   API docs: `http://localhost:8000/docs`

---

### Frontend Setup

1. **Navigate to the frontend directory**
   ```bash
   cd choremate-app
   ```

   2. **Install dependencies**
   ```bash
   npm install
   ```

   3. **Run the development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173` (or the port shown in terminal)

---

### Quick Start (Running Both)

**Terminal 1 - Backend:**
```bash
cd backend
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
uvicorn app.main:app --reload**Terminal 2 - Frontend:**
cd choremate-app
npm run devThen open your browser to `http://localhost:5173`
```

---

## 🔧 Development Workflow

### Branch Strategy

- **`dev`**: Main development branch (default)
  - All feature branches merge here
  - Requires PR and CI checks to pass

- **`mvp`**: MVP/release branch
  - Stable code ready for deployment
  - Requires PR, CI checks, and approval from another developer


### Code Formatting

We use **Black** for Python code formatting with a line length of 88 characters.

- **Automatic formatting**: Pre-commit hooks format code before each commit
- **Manual formatting**: Run `black app tests` in the `backend/` directory
- **CI Check**: GitHub Actions verifies formatting on every PR

---

## 📁 Project Structure

```
choremate/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # API routes
│   │   ├── core/        # Business logic
│   │   ├── db/          # Database configuration
│   │   ├── models/      # Database models
│   │   └── schemas/     # Pydantic schemas
│   ├── create_db.py     # Database initialization
│   └── requirements.txt
│
└── choremate-app/       # React frontend
    ├── src/
    │   ├── pages/       # Page components
    │   ├── components/  # Reusable components
    │   └── utils/       # API utilities
    └── package.json
```

---

## 🛠️ Tech Stack

**Backend:**
- FastAPI
- SQLAlchemy
- SQLite
- Google Gemini AI

**Frontend:**
- React
- Vite
- Lucide Icons
```