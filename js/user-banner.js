document.addEventListener("DOMContentLoaded", () => {
    const pointsElement = document.getElementById("user-points-count");
    if (!pointsElement) return;

    const targetPoints = 1250; // Este valor puede venir de una API
    let currentPoints = 0;
    const duration = 1200; // ms
    const stepTime = 20;
    const increment = targetPoints / (duration / stepTime);

    const timer = setInterval(() => {
        currentPoints += increment;
        if (currentPoints >= targetPoints) {
            pointsElement.textContent = targetPoints.toLocaleString();
            clearInterval(timer);
        } else {
            pointsElement.textContent = Math.floor(currentPoints).toLocaleString();
        }
    }, stepTime);
});