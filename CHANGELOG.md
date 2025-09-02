# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-09-01

### Added

- Sales period closing
- Activities log and audit trails
- Ability to void/remove sales
- More user roles and permissions
- Ability Deactivate users
- Help window

### Improved / Changed

- Sales Recording UI
- Permissions
- Added pagination to user management screen

### Bug Fixes

- Fixed Dashboard: Refresh/loading issue
- Resolved Sales and Expenses Entries pagination not resetting
- Fixed Negative profit is showing green for dashboard chart
- Fixed Organization details disappearing
- Fixed Profile name not reflecting automatically after profile update
- Fixed branch assignment issue for admin users


## [1.0.1] - 2025-08-15

## [1.0.0] - 2025-08-13

### Added

- Complete sales tracking and management system
- Expense tracking and categorization
- User management with role-based access control
- Organization management
- Dashboard with analytics and reports
- Receipt generation for sales and expenses
- Multi-organization support
- Secure authentication with Supabase

### Features

- **Sales Management**: Record and track sales with detailed information
- **Expense Tracking**: Categorize and monitor business expenses
- **User Roles**: Admin and staff roles with appropriate permissions
- **Reports**: Generate comprehensive business reports
- **Multi-tenant**: Support for multiple organizations
- **Security**: Secure authentication and data protection

### Technical Details

- Built with React, TypeScript, and Vite
- Backend powered by Supabase
- Modern UI with Tailwind CSS and shadcn/ui components
- Electron desktop application support
- Cross-platform compatibility (Windows, macOS, Linux)
