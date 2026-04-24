import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";

export const getTransactionsFromDB = async () => {
  const q = query(collection(db, "transactions"), orderBy("date", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
