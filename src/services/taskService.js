import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  doc, 
  query, 
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';

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
    console.error('Error saving wellness score', error);
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


// Add recurring tasks — generates one Firestore task per matching weekday with per-day times
export const addRecurringTask = async (templateData, selectedDays, endDate, dayTimes) => {
  try {
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const targetDays = selectedDays.map(d => dayMap[d]);

    const current = new Date();
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let count = 0;
    const templateName = `${templateData.title.replace(/\s+/g, '_')}_${Date.now()}`;

    while (current <= end) {
      if (targetDays.includes(current.getDay())) {
        const dayAbbr = Object.keys(dayMap).find(k => dayMap[k] === current.getDay());
        const times = dayTimes ? dayTimes[dayAbbr] : null;

        const taskDate = new Date(current);
        if (times) {
          taskDate.setHours(times.startHour, times.startMinute, 0, 0);
        }

        const deadlineStr = times
          ? taskDate.toISOString()
          : taskDate.toISOString().split('T')[0];

        let description = templateData.description;
        if (times) {
          const startD = new Date(current);
          startD.setHours(times.startHour, times.startMinute, 0, 0);
          const endD = new Date(current);
          endD.setHours(times.endHour, times.endMinute, 0, 0);
          const startLabel = startD.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          const endLabel = endD.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          description = templateData.description
            ? `${templateData.description} (${startLabel} - ${endLabel})`
            : `Scheduled ${startLabel} - ${endLabel}`;
        }

        const taskDoc = {
          userId: templateData.userId,
          title: templateData.title,
          description,
          category: templateData.category,
          priority: templateData.priority,
          deadline: deadlineStr,
          assignments: [],
          createdAt: serverTimestamp(),
          isCompleted: false,
          progress: 0,
          recurrence: {
            templateName,
            frequency: 'weekly',
            days: selectedDays,
            instanceDate: taskDate.toISOString().split('T')[0],
          },
        };

        const score = computePriorityScore(taskDoc);
        taskDoc.priorityScore = score;
        taskDoc.priorityLabel = getPriorityLabel(score);

        await addDoc(collection(db, 'tasks'), taskDoc);
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  } catch (error) {
    console.error('Error adding recurring tasks:', error);
    return 0;
  }
};

// Delete all tasks belonging to a recurring template
export const deleteRecurringTasks = async (templateName) => {
  try {
    const q = query(
      collection(db, 'tasks'),
      where('recurrence.templateName', '==', templateName)
    );
    const snapshot = await getDocs(q);
    const deletes = snapshot.docs.map(d => deleteDoc(doc(db, 'tasks', d.id)));
    await Promise.all(deletes);
    return snapshot.size;
  } catch (error) {
    console.error('Error deleting recurring tasks:', error);
    return 0;
  }
};
export const addClassSchedule = async (scheduleData) => {
  try {
    const dayMap = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0 };
    const targetDays = scheduleData.days.map(d => dayMap[d]);

    const current = new Date();
    current.setHours(0, 0, 0, 0);
    const end = new Date(scheduleData.endDate);
    end.setHours(23, 59, 59, 999);

    let count = 0;
    const templateName = `class_${scheduleData.className.replace(/\s+/g, '_')}_${Date.now()}`;

    while (current <= end) {
      if (targetDays.includes(current.getDay())) {
        const dayName = Object.keys(dayMap).find(k => dayMap[k] === current.getDay());
        const times = scheduleData.dayTimes[dayName];
        if (!times) { current.setDate(current.getDate() + 1); continue; }

        const taskDate = new Date(current);
        taskDate.setHours(times.startHour, times.startMinute, 0, 0);

        const endDate = new Date(current);
        endDate.setHours(times.endHour, times.endMinute, 0, 0);

        const startLabel = taskDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const endLabel = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        const taskDoc = {
          userId: scheduleData.userId,
          ownerEmail: scheduleData.ownerEmail,
          ownerName: scheduleData.ownerName,
          title: scheduleData.className,
          description: `Class scheduled ${startLabel} - ${endLabel}`,
          category: scheduleData.category,
          priority: 'Medium',
          deadline: taskDate.toISOString(),
          assignments: [],
          createdAt: serverTimestamp(),
          isCompleted: false,
          progress: 0,
          recurrence: {
            templateName,
            frequency: 'weekly',
            days: scheduleData.days,
            instanceDate: taskDate.toISOString().split('T')[0],
            isClassSchedule: true,
          },
        };

        const score = computePriorityScore(taskDoc);
        taskDoc.priorityScore = score;
        taskDoc.priorityLabel = getPriorityLabel(score);

        await addDoc(collection(db, 'tasks'), taskDoc);
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  } catch (error) {
    console.error('Error adding class schedule:', error);
    return 0;
  }
};