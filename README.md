
# SmartRoute — Intelligent IT Support Ticket Management

SmartRoute is a full-stack IT support ticket management prototype featuring explainable, skill-based and workload-aware engineer recommendations.

It helps support teams manage IT issues and make informed ticket assignment decisions based on engineer specialization and current workload.

## Key Features

- Create and manage IT support tickets
- Categorize issues as Network, Hardware or Software
- Assign Low, Medium or High priority
- View ticket statistics on an interactive dashboard
- Recommend suitable engineers using a weighted scoring algorithm
- Explain recommendation scores and ranking
- Assign tickets to available engineers
- Track engineer capacity and workload utilization
- Resolve assigned support tickets
- Store and retrieve information using PostgreSQL
- Navigate between dedicated management pages
- Reset demo tickets and assignments in local development mode

## Technology Stack

**Frontend**
- React
- JavaScript
- Tailwind CSS
- React Router
- Vite

**Backend**
- Node.js
- Express.js
- REST APIs

**Database**
- Supabase PostgreSQL

**Development Tools**
- Visual Studio Code
- Git and GitHub

## Smart Assignment Algorithm

SmartRoute uses a deterministic, explainable recommendation algorithm.

Recommendations consider:

1. Engineer skill compatibility
2. Current active workload
3. Engineer specialization
4. Ticket priority weighting
5. Engineer availability and capacity

Eligible engineers are ranked using a weighted scoring approach. The system also displays explanations for the recommendations.

The current algorithm is rule-based and does not use a trained machine learning model.

## Application Modules

### Dashboard
Displays ticket statistics, including total, open, in-progress and resolved tickets.

### Ticket Management
Allows users to create tickets, view support issues and resolve assigned tickets.

### Smart Assignment
Recommends suitable support engineers, displays explanation scores and supports ticket assignment.

### Engineer Management
Displays engineers, skills, availability, maximum capacity, active workload and utilization.

## Running Locally

### Prerequisites
- Node.js and npm
- A configured Supabase project
- Required PostgreSQL tables, functions and permissions

### Clone Repository

```bash
git clone <your-repository-url>
cd SmartRoute
```

### Install Backend Dependencies

```bash
cd backend
npm install
```

Create a `.env` file inside the backend folder:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_supabase_secret_key
ENABLE_DEMO_RESET=false
```

Keep this file private. Never commit real credentials.

Start the backend:

```bash
node server.js
```

### Install Frontend Dependencies

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

The current development version uses the Express API at `http://localhost:5000`.

**Database note:** The existing application requires the Supabase database schema, engineer seed records and SQL functions to be configured separately. Automated database migrations are planned for a future version.

## Demo Workflow

1. Create a support ticket.
2. Select the ticket in Smart Assignment.
3. View recommended engineers and explanation scores.
4. Assign the ticket to a suitable engineer.
5. Check the updated engineer workload.
6. Resolve the ticket.
7. Verify that ticket status and workload update correctly.

A local-development-only reset feature is available for preparing fresh demonstrations.

## Project Status

**Version 1.0 — Functional Prototype**

Implemented and manually tested:
- Ticket creation and persistence
- Engineer recommendations
- Ticket assignment
- Workload tracking
- Ticket resolution
- Demo data reset
- React page navigation

### Planned Improvements

- Authentication and role-based access control
- Separate employee, manager and engineer dashboards
- Backend authorization and security hardening
- Automated tests and database migrations
- Secure cloud deployment
- Notifications and audit history

## Security Notice

This repository represents a development prototype, not production-ready enterprise software.

The current version does not include user authentication or role-based API authorization.

Do not publicly deploy it for real organizational data without implementing the required security protections.

## License

No open-source license has been selected yet.

---

Built as a full-stack software engineering portfolio project.
