import { showToast } from "../common/toast.js";

document.getElementById("sendButton").addEventListener("click", () => {
  const phoneNumber = document.getElementById("phoneNumber").value.trim();
  if (phoneNumber) {
    const whatsappUrl = `https://wa.me/${phoneNumber}`;
    window.open(whatsappUrl, "_blank");
  } else {
    showToast({ title: "Invalid number", body: "Please enter a valid phone number.", color: "bg-danger" });
  }
});
