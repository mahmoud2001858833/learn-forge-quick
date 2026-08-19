import "@testing-library/jest-dom/vitest";

// Supabase env used by the browser client during tests.
process.env.VITE_SUPABASE_URL ??= "http://localhost:54321";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "test-key";
