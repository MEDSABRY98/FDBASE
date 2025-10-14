# ⚽ Football Database Manager v2.0

A comprehensive Flask web application for managing football statistics with automatic Google Sheets synchronization, desktop application support, and advanced caching.

🌐 **Live Demo**: [fdbase.vercel.app](https://fdbase.vercel.app)

## 🎯 Features

### 📊 Multiple Statistics Pages
- **Al Ahly Stats** - Complete match statistics with player performance
- **Al Ahly PKs Stats** - Penalty kicks analysis and records
- **Al Ahly Finals** - Finals matches history and statistics
- **Ahly vs Zamalek** - Derby matches statistics
- **Egypt National Team** - National team matches and lineups
- **Egypt Youth Teams** - Youth team statistics
- **Egyptian Clubs** - Inter-club competition data

### 🔄 Google Sheets Integration
- **Auto-Sync Service**: Automatic synchronization every 6 hours
- **Manual Sync**: Trigger immediate updates via API
- **Cache Management**: Smart caching with configurable TTL
- **Multi-Sheet Support**: Handle multiple worksheets simultaneously
- **Offline Support**: Cached data available when offline

### 💾 Advanced Cache System
- **Hybrid Cache**: Supports both Redis (production) and File-based (local)
- **Smart Naming**: Files named by page (e.g., `Al_Ahly_Stats_all_sheets.json`)
- **Database Prefix**: Database lists prefixed with `db_` (e.g., `db_Teams_List.json`)
- **Auto-Cleanup**: TTL-based cache expiration
- **Cache Location**: `%LOCALAPPDATA%\FootballDataManager\cache` (Windows)

### 🖥️ Desktop Application
- **Standalone EXE**: No Python installation required
- **PyWebView GUI**: Native window experience
- **Embedded Server**: Waitress WSGI server included
- **Resource Bundling**: All templates, static files, and credentials bundled
- **Windows Optimized**: Full Windows compatibility

### 📝 Data Entry System
- **Match Recording**: Comprehensive match details entry
- **Player Lineups**: Track player positions and jersey numbers
- **Penalty Kicks**: Detailed PK results tracking
- **Validation**: Client and server-side validation
- **Auto-Save**: Data automatically synced to Google Sheets

## 🚀 Quick Start

### Web Application

1. **Clone the repository**
```bash
git clone https://github.com/MEDSABRY98/FDBASE.git
cd FDBASE
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Set up Google Sheets credentials**
   - Place your service account JSON in `credentials/` folder
   - Or set environment variables (see Configuration below)

4. **Run the application**
```bash
python app.py
```

5. **Access at** `http://localhost:5000`

### Desktop Application

1. **Download** `FootballDataManager.exe` from releases
2. **Run** the executable (no installation needed)
3. **Access** via the built-in browser window

### Building Desktop App

```bash
pip install -r requirements-desktop.txt
pyinstaller build_desktop.spec --clean
```

The executable will be in `dist/FootballDataManager.exe`

## ⚙️ Configuration

### Environment Variables

```bash
# Google Sheets Credentials
export GOOGLE_CREDENTIALS_JSON_AHLY_MATCH='{"type": "service_account", ...}'
export GOOGLE_CREDENTIALS_JSON_AHLY_PKS='...'
export GOOGLE_CREDENTIALS_JSON_AHLY_FINALS='...'

# Sheet IDs
export AHLY_MATCH_SHEET_ID='your_sheet_id'
export AHLY_PKS_SHEET_ID='your_sheet_id'
export AHLY_FINALS_SHEET_ID='your_sheet_id'

# Cache Configuration
export CACHE_TTL_HOURS=6
export REDIS_URL='redis://...'  # For production
```

### Google Sheets Setup

1. Create a Google Cloud Project
2. Enable Google Sheets API and Google Drive API
3. Create a Service Account
4. Download credentials JSON
5. Share your spreadsheets with the service account email

## 📁 Project Structure

```
FDBASE/
├── api/                        # Vercel serverless functions
├── credentials/                # Google credentials (gitignored)
├── static/                     # Static assets
│   ├── al_ahly_stats/         # Al Ahly Stats page
│   ├── al_ahly_pks_stats/     # PKs page
│   ├── al_ahly_finals/        # Finals page
│   ├── al_ahly_vs_zamalek/    # Derby page
│   └── ...
├── templates/                  # HTML templates
├── app.py                      # Main Flask application
├── app_desktop.py             # Desktop application entry
├── cache_manager.py           # Hybrid cache system
├── google_sheets_sync.py      # Auto-sync service
├── scheduler_service.py       # Background scheduler
├── build_desktop.spec         # PyInstaller spec
└── requirements*.txt          # Dependencies

```

## 🔧 API Endpoints

### Google Sheets Auto-Sync
- `GET /api/ahly-stats/sheets-data` - Get cached data
- `POST /api/ahly-stats/sync-now` - Trigger immediate sync
- `GET /api/ahly-stats/sync-status` - Check sync status

### Statistics Data
- `GET /api/pks-stats-data` - PKs statistics
- `GET /api/finals-data` - Finals statistics
- `GET /api/ahly-vs-zamalek/matches` - Derby matches

### Database Lists
- `GET /api/teams` - Teams database
- `GET /api/stadiums` - Stadiums database
- `GET /api/champions` - Championships database
- `GET /api/managers` - Managers database
- `GET /api/referees` - Referees database

## 🎨 Features in Detail

### Cache Manager
- **Automatic Detection**: Uses Redis on Render, file-based locally
- **Smart TTL**: Configurable cache lifetime
- **Page-Named Files**: Easy identification of cached data
- **Metadata Storage**: Tracks cache age and source

### Google Sheets Sync
- **Background Scheduler**: Non-blocking sync operations
- **Error Handling**: Robust error recovery
- **Multiple Sheets**: Syncs all configured sheets
- **Status Tracking**: Real-time sync status API

### Desktop Application
- **PyInstaller Build**: Single executable file
- **Resource Path Handling**: Proper path resolution for bundled resources
- **Credentials Support**: Embedded credentials or environment variables
- **GUI Integration**: PyWebView for native window

## 🛠️ Development

### Run in Development Mode
```bash
export FLASK_ENV=development
python app.py
```

### Run Tests
```bash
python -m pytest tests/
```

### Code Quality
```bash
flake8 app.py
black app.py
```

## 📦 Deployment

### Vercel (Web)
1. Install Vercel CLI: `npm install -g vercel`
2. Deploy: `vercel --prod`
3. Set environment variables in Vercel dashboard

### Render (Web Service)
- Use `render.yaml` for automatic deployment
- Configure environment variables in Render dashboard
- Redis add-on recommended for caching

### Desktop Distribution
- Build with PyInstaller
- Distribute the `dist/FootballDataManager.exe`
- Optionally create installer with NSIS or Inno Setup

## 🔒 Security

- Credentials files are gitignored
- Service account with minimal permissions
- Environment variables for sensitive data
- CORS configured for production domains

## 📝 License

This project is private and proprietary.

## 👤 Author

**MEDSABRY98**
- GitHub: [@MEDSABRY98](https://github.com/MEDSABRY98)

## 🙏 Acknowledgments

- Google Sheets API
- Flask Framework
- PyInstaller
- PyWebView
- Vercel Platform

## 📊 Version History

### v2.0 (Current)
- ✅ Complete rebuild with enhanced architecture
- ✅ Google Sheets auto-sync with cache manager
- ✅ Desktop application with PyInstaller
- ✅ Fixed credentials path for Windows build
- ✅ Enhanced cache system with page-named files
- ✅ Removed mock data from all pages
- ✅ Multi-page support (7+ statistics pages)
- ✅ Modern responsive UI

### v1.0
- Initial release
- Basic Google Sheets integration
- Simple data entry forms

---

Made with ⚽ and ❤️ for Football Statistics

