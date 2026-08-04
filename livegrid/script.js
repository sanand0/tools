// @ts-check
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.2.6/+esm";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

import { createLiveGrid } from "./app.js?v=3";

const firebaseConfig = {
  apiKey: "AIzaSyBb6_rERxcWd2P6QbydzS_8hsY1OcsLG7I",
  authDomain: "tools-anand.firebaseapp.com",
  projectId: "tools-anand",
  storageBucket: "tools-anand.firebasestorage.app",
  messagingSenderId: "498747162553",
  appId: "1:498747162553:web:59609d6693b04fef2c4068",
  measurementId: "G-D7MS4ZJK8V",
};

const db = getFirestore(initializeApp(firebaseConfig));
createLiveGrid({
  window,
  document,
  firebase: { db, deleteDoc, doc, onSnapshot, setDoc },
  qrCode: QRCode,
  sanitizeHtml: (html) => DOMPurify.sanitize(html),
  showAlert: bootstrapAlert,
});
