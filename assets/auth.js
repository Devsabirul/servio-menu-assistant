
import { auth, db, googleProvider } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// =====================================
// EXPORT FIREBASE
// =====================================

export { auth, db, onAuthStateChanged };


// =====================================
// EMAIL LOGIN
// =====================================

export const loginEmail = async (email, password) => {

  email = (email || "").trim();

  if (!email || !password) {
    throw new Error("Please enter email and password.");
  }

  return await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
};


// =====================================
// GOOGLE LOGIN
// =====================================

export const loginGoogle = async () => {

  return await signInWithPopup(
    auth,
    googleProvider
  );

};


// =====================================
// LOGOUT
// =====================================

export const logout = async () => {

  return await signOut(auth);

};


// =====================================
// EMAIL REGISTRATION
// =====================================

export async function registerEmail(name, email, password) {

  // Validate inputs
  name = (name || "").trim();
  email = (email || "").trim();

  if (!name || !email || !password) {
    throw new Error("Please fill in all required fields.");
  }

  if (password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  // Create Firebase account
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  // Update Firebase display name
  await updateProfile(
    credential.user,
    {
      displayName: name
    }
  );

  // Create Firestore user document
  await setDoc(
    doc(db, "users", credential.user.uid),
    {
      name: name,
      email: email,
      restaurantName: "",
      createdAt: serverTimestamp()
    }
  );

  return credential;

}
