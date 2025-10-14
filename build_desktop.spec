# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller Spec File for Football Database Desktop Application
================================================================
This creates a single executable with PyWebView GUI (no browser needed!)
"""

import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all data files
datas = []
datas += [('templates', 'templates')]
datas += [('static', 'static')]
datas += [('credentials', 'credentials')]

# Collect google auth and related packages
datas += collect_data_files('google.auth')
datas += collect_data_files('google.oauth2')
datas += collect_data_files('googleapiclient')
datas += collect_data_files('gspread')
datas += collect_data_files('certifi')

# Collect hidden imports
hiddenimports = []
hiddenimports += collect_submodules('google.auth')
hiddenimports += collect_submodules('google.oauth2')
hiddenimports += collect_submodules('googleapiclient')
hiddenimports += collect_submodules('gspread')
hiddenimports += collect_submodules('flask')
hiddenimports += collect_submodules('jinja2')
hiddenimports += collect_submodules('pandas')
hiddenimports += collect_submodules('openpyxl')
hiddenimports += collect_submodules('webview')
hiddenimports += collect_submodules('waitress')
hiddenimports += [
    'googleapiclient',
    'google.auth._credentials_async',
    'google.auth._default_async',
    'google.auth._jwt_async',
    'google.auth._oauth2client',
    'google.auth.crypt._helpers',
    'google.auth.downscoped',
    'google.auth.transport._aiohttp_requests',
    'google.auth.transport.grpc',
    'google.auth.transport.mtls',
    'google.auth.transport.urllib3',
    'googleapiclient._auth',
    'googleapiclient.channel',
    'googleapiclient.discovery',
    'googleapiclient.sample_tools',
    'flask.json',
    'flask.json.provider',
    'werkzeug.security',
    'jinja2.ext',
    'pandas._libs.tslibs.timedeltas',
    'pandas._libs.tslibs.nattype',
    'pandas._libs.tslibs.np_datetime',
    'webview',
    'webview.platforms',
    'webview.platforms.winforms',
    'clr',
    'clr_loader',
    'pythonnet',
]

a = Analysis(
    ['app_desktop.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
        'tkinter',
        'test',
        'tests',
        'IPython',
        'notebook',
        'jupyter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='FootballDataManager',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window - pure GUI
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

