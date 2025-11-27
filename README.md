# choremate
Making household chores collaborative, fair, and actually enjoyable for shared living spaces

## 🚀 Getting Started

### Backend Setup

1. **Clone the repository**
   
   ```bash
   git clone https://github.com/prashanthjaganathan/choremate.git
   cd choremate
   ```
   
2. **Create and activate a virtual environment**
   
   ```bash
   cd backend
   python -m venv .venv
   
   # On macOS/Linux:
   source .venv/bin/activate
   
   # On Windows:
   .venv\Scripts\activate
   ```

3. **Install dependencies**h
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Install pre-commit hooks**
   ```bash
   cd ..  # Go to repo root
   pre-commit install
   ```

6. **Run the application**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```
   The API will be available at `http://localhost:8000`
   

## 🔧 Development Workflow

### Branch Strategy

- **`dev`**: Main development branch (default)
  - All feature branches merge here
  - Requires PR and CI checks to pass

- **`mvp`**: MVP/release branch
  - Stable code ready for deployment
  - Requires PR, CI checks, and approval from another developer


### Code Formatting

We use **Black** for code formatting with a line length of 88 characters.

- **Automatic formatting**: Pre-commit hooks format code before each commit
- **Manual formatting**: Run `black app tests` in the `backend/` directory
- **CI Check**: GitHub Actions verifies formatting on every PR