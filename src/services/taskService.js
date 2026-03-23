import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  doc, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';

// Get all tasks for the current user
export const getUserTasks = async (userId) => {
  try {
    const q = query(

  collection(db, 'tasks'),
  where('userId', '==', userId)
);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
  }
};

// Add a new task
export const addTask = async (taskData) => {
  try {
    const docRef = await addDoc(collection(db, 'tasks'), {
      ...taskData,
      createdAt: serverTimestamp(),
      isCompleted: false,
      progress: 0,
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding task:', error);
    return null;
  }
};

// Update task progress
export const updateTaskProgress = async (taskId, progress) => {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    await updateDoc(taskRef, {
      progress: progress,
      isCompleted: progress === 100,
    });
    return true;
  } catch (error) {
    console.error('Error updating task:', error);
    return false;
  }
};

// Update task fields (for editing)
export const updateTask = async (taskId, taskData) => {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    await updateDoc(taskRef, taskData);
    return true;
  } catch (error) {
    console.error('Error updating task:', error);
    return false;
  }
};


// Delete a task
export const deleteTask = async (taskId) => {
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    return false;
  }
};

// Save WHO-5 score 
export const saveWellnessScore = async (userId, scoreData) => {
  try {
    const docRef = await addDoc(collection(db, 'wellness'),{
      userId,
      ...scoreData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }
  catch (error) {
    console.error('Error saving welness score', error);
    return null;
  }
};

// Retreive WHO-5 History
export const getWellnessHistory = async (userId) => {
  try {
    const q = query(
      collection(db, 'wellness'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching wellness history:', error);
    return [];
  }
};