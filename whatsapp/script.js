import { showToast } from "../common/toast.js";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
saveform("#whatsapp-form");

document.getElementById("sendButton").addEventListener("click", () => {
  const phoneNumber = document.getElementById("phoneNumber").value.trim();
  if (phoneNumber) {
    const whatsappUrl = `https://wa.me/${phoneNumber}`;
    window.open(whatsappUrl, "_blank");
  } else {
    showToast({ title: "Invalid number", body: "Please enter a valid phone number.", color: "bg-danger" });
  }
});
