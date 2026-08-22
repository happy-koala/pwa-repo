const apps = [
  {
    name: "Solitär",
    folder: "solitaire",
    icon: "icon-192.png"
  }
  // Weitere Apps hier ergänzen:
  // {
  //   name: "Nächstes Spiel",
  //   folder: "naechstes-spiel",
  //   icon: "icon-192.png"
  // }
];

function renderApps() {
  const grid = document.getElementById("app-grid");

  apps.forEach((app) => {
    const link = document.createElement("a");
    link.className = "app-card";
    link.href = `${app.folder}/`;

    if (app.icon) {
      const img = document.createElement("img");
      img.className = "app-icon";
      img.style.visibility = "hidden";
      img.src = `${app.folder}/${app.icon}`;
      img.alt = `${app.name} Icon`;

      img.onload = () => {
        img.style.visibility = "visible";
      };

      img.onerror = () => {
        img.remove();
      };

      link.appendChild(img);
    }

    const title = document.createElement("h2");
    title.textContent = app.name;

    link.appendChild(title);
    grid.appendChild(link);
  });
}

renderApps();