# For All Ages - Setup Guide

### Cloning the repository:

- On the `Code` tab on GitHub, click the green code button and copy the url shown.
- Then, in your preferred folder (wherever you want the project to be), run `git clone <url>` with the copied url
- Change directories into the project folder with `cd` and then run the following commands:

```
npm install
npm run dev
```

You should get a localhost link that can be pasted into your browser to display the app.

### Frontend Environment Setup

Create a `.env` (or `.env.local`) file in the project root with:

```env
VITE_API_URL=http://localhost:3001
```

`VITE_PINECONE_*` environment variables, you can remove them.

### Running with Backend

For full functionality (including new user registration with Pinecone), you'll need to run the backend matching service:

1. In a separate terminal, navigate to the `matching` folder and follow its setup instructions
2. Start the backend server (it will run on port 3001)
3. Then start the frontend with `npm run dev`

See the `matching` folder README for backend setup instructions.
