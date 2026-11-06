ATP POS - Final Operations Patch

1. Replace files in the ATP POS project.
2. During development:
   - backend: pnpm dev
   - frontend: pnpm dev
3. Before using START_WINDOWS.bat for the first time after code changes:
   - run BUILD_WINDOWS.bat once.
4. Daily shop use:
   - START_WINDOWS.bat -> opens POS on http://localhost:3001
   - STOP_WINDOWS.bat -> safely stops the local POS server
5. Restore:
   - STOP_WINDOWS.bat
   - RESTORE_BACKUP.bat
   - choose a .db file from backups
   - START_WINDOWS.bat

IMPORTANT:
Never manually replace data/atelier.db while the backend is running.
