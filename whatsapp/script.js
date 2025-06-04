document.getElementById("sendButton").addEventListener("click", () => {
  const phoneNumber = document.getElementById("phoneNumber").value.trim();
  if (phoneNumber) {
    const whatsappUrl = `https://wa.me/${phoneNumber}`;
    window.open(whatsappUrl, "_blank");
  } else {
    alert("Please enter a valid phone number.");
  }
});
