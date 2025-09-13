---
description: Repository Information Overview
alwaysApply: true
---

# Shadcn-UI Family Tree Information

## Summary

A React-based family tree visualization application that allows users to create, manage, and visualize family relationships. The application uses React Flow for tree visualization and includes features for user management, family tree administration, and data persistence with PostgreSQL.

## Structure

- `/src`: Main application source code with components, pages, and utilities
- `/server`: Express.js backend server with PostgreSQL database integration
- `/public`: Static assets and resources
- `/dist`: Production build output directory

## Language & Runtime

**Language**: TypeScript/JavaScript
**Version**: TypeScript 4.9.x
**Build System**: Vite 4.1.4
**Package Manager**: npm

## Dependencies

**Main Dependencies**:

- React 18.3.1
- React DOM 18.3.1
- @xyflow/react 12.8.3 (React Flow)
- @dagrejs/dagre 1.1.4 (Graph layout)
- Express 5.1.0
- PostgreSQL (pg 8.16.3)
- html-to-image 1.11.13
- html2canvas 1.4.1
- react-draggable 4.5.0

**Development Dependencies**:

- TypeScript 4.9.0
- Vite 4.1.4
- @vitejs/plugin-react 3.1.0
- @types/react 18.3.1
- @types/react-dom 18.3.1

## Build & Installation

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run backend server
node server/server.js
```

## Application Architecture

**Frontend**:

- React with TypeScript
- React Flow for interactive tree visualization
- Vite for build and development

**Backend**:

- Express.js server
- PostgreSQL database with connection to Neon (cloud PostgreSQL)
- RESTful API endpoints for family tree management

## Database Schema

- **users**: Stores user information with UUID as primary key
- **family_trees**: Stores family tree data with JSON structure
- **family_admins**: Manages admin permissions for family trees
- **activity_logs**: Tracks user actions and changes

## Main Features

- Interactive family tree visualization
- Multi-user access with admin permissions
- Family tree creation and editing
- Access code system for sharing family trees
- Activity logging for administrative oversight
- Responsive design for various screen sizes

## Entry Points

- **Frontend**: index.tsx → App.tsx
- **Backend**: server/server.js
