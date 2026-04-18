import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, limit, getDocs } from 'firebase/firestore';
export { doc, updateDoc };
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export type UserRole = 'passenger' | 'rider';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  rating: number;
  totalTrips: number;
  avatarUrl?: string;
  isOnline?: boolean;
  badges?: string[];
  currentLocation?: { lat: number; lng: number };
  gender?: string;
  dob?: string;
  vehicleType?: 'car' | 'motorcycle';
  licenseClass?: string;
  vehicleModel?: string;
  numberPlate?: string;
  favoriteUserIds?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
  };
}

export type RideStatus = 'requested' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
export type RatingReason = 'driving' | 'timing' | 'navigation';

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  isActive: boolean;
}

export interface Ride {
  id: string;
  passengerId: string;
  riderId?: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    address: string;
    lat: number;
    lng: number;
  };
  status: RideStatus;
  fare: number;
  discountAmount?: number;
  promoCode?: string;
  cancellationReason?: string;
  riderRating?: number;
  ratingReason?: RatingReason;
  createdAt: any;
  updatedAt?: any;
}

// User Profile Actions
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() as UserProfile : null;
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', profile.uid), profile);
}

// Ride Actions
export async function createRideRequest(ride: Omit<Ride, 'id' | 'createdAt'>): Promise<string> {
  // Firestore does not accept undefined values. Filter them out.
  const cleanRide = Object.fromEntries(
    Object.entries(ride).filter(([_, v]) => v !== undefined)
  );
  const docRef = await addDoc(collection(db, 'rides'), {
    ...cleanRide,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateRideStatus(rideId: string, status: RideStatus, riderId?: string, cancellationReason?: string): Promise<void> {
  const updateData: any = { 
    status, 
    updatedAt: serverTimestamp() 
  };
  if (riderId) updateData.riderId = riderId;
  if (cancellationReason) updateData.cancellationReason = cancellationReason;
  
  await updateDoc(doc(db, 'rides', rideId), updateData);
}

export async function rateRide(rideId: string, rating: number, reason: RatingReason): Promise<void> {
  await updateDoc(doc(db, 'rides', rideId), {
    riderRating: rating,
    ratingReason: reason,
    updatedAt: serverTimestamp()
  });
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  const q = query(collection(db, 'promoCodes'), where('code', '==', code.toUpperCase()), where('isActive', '==', true));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as PromoCode;
}

export async function updateUserLocation(uid: string, lat: number, lng: number): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    currentLocation: { lat, lng },
    updatedAt: serverTimestamp()
  });
}

// Map Helpers
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'SwiftRide-App-Build'
      }
    });
    if (!response.ok) throw new Error('Geocoding failed');
    const data = await response.json();
    return data.display_name || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } catch (error) {
    console.error("Geocoding error", error);
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}

// Subscriptions
export function subscribeToUserProfile(uid: string, callback: (profile: UserProfile) => void) {
  return onSnapshot(doc(db, 'users', uid), (doc) => {
    if (doc.exists()) {
      callback({ uid: doc.id, ...doc.data() } as UserProfile);
    }
  });
}

export function subscribeToActiveRide(rideId: string, callback: (ride: Ride) => void) {
  return onSnapshot(doc(db, 'rides', rideId), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Ride);
    }
  });
}

export function subscribeToAvailableRides(callback: (rides: Ride[]) => void) {
  const q = query(
    collection(db, 'rides'),
    where('status', '==', 'requested'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  
  return onSnapshot(q, (snapshot) => {
    const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
    callback(rides);
  });
}

export function subscribeToUserRides(uid: string, role: UserRole, callback: (rides: Ride[]) => void) {
  const field = role === 'passenger' ? 'passengerId' : 'riderId';
  const q = query(
    collection(db, 'rides'),
    where(field, '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  
  return onSnapshot(q, (snapshot) => {
    const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
    callback(rides);
  });
}
