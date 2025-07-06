'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { db } from './db';

// This function will now do nothing related to cookies.
// It's kept for flow compatibility with the login action.
export async function setSession(userId: number) {
  // No-op. The client will handle redirection after login.
}

// This function will always return the FIRST user from the database,
// acting as a mock logged-in user for development. This avoids using cookies.
export async function getSession() {
  try {
    // To make this work, a user must exist in the database.
    // The signup page should be used to create at least one user.
    const mockUser = await db.query.users.findFirst({
        columns: {
            id: true,
            displayName: true,
            email: true,
        }
    });
  
    return mockUser || null; // Return the first user found, or null if DB is empty.
  } catch (error) {
    console.error("Mock session retrieval error:", error);
    return null;
  }
}

// This function will now just redirect to the login page, simulating a logout.
export async function deleteSession() {
  // No cookie to delete.
  redirect('/login');
}
