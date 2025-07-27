import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
saveform("#whatsapp-form");

document.getElementById("sendButton").addEventListener("click", () => {
  const phoneNumber = document.getElementById("phoneNumber").value.trim();
  if (phoneNumber) {
    const whatsappUrl = `https://wa.me/${phoneNumber}`;
    window.open(whatsappUrl, "_blank");
  } else {
    bootstrapAlert({ title: "Invalid number", body: "Please enter a valid phone number.", color: "danger" });
  }
});
