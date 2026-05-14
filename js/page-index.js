/**
 * Page index : classes, import, tableau élèves, édition popup.
 */
(function () {
  const S = window.EPSStorage;
  const C = window.EPSCore;
  const MAX_STU = C.MAX_GROUP;

  const el = {
    alertRoot: document.getElementById("alert-root"),
    classSelect: document.getElementById("class-select"),
    className: document.getElementById("class-name"),
    btnSaveClass: document.getElementById("btn-save-class"),
    btnDeleteClass: document.getElementById("btn-delete-class"),
    importText: document.getElementById("import-text"),
    btnImport: document.getElementById("btn-import"),
    groupsContainer: document.getElementById("groups-container"),
    addGroup: document.getElementById("add-group"),
    addNom: document.getElementById("add-nom"),
    addPrenom: document.getElementById("add-prenom"),
    addArrete: document.getElementById("add-arrete"),
    addLance: document.getElementById("add-lance"),
    btnAddStudent: document.getElementById("btn-add-student"),
    modalRoot: document.getElementById("modal-root"),
  };

  (function checkLocalStorage() {
    try {
      localStorage.setItem("__eps_rel_ls", "1");
      localStorage.removeItem("__eps_rel_ls");
    } catch (err) {
      var b = document.getElementById("storage-blocked-banner");
      if (b) {
        b.hidden = false;
        b.textContent =
          "Le stockage du navigateur est bloqué (navigation privée, réglages « cookies » ou quota). Les classes ne peuvent pas être enregistrées sur cet appareil.";
      }
    }
  })();

  let state = S.ensureSeed();

  function showAlert(type, message) {
    el.alertRoot.innerHTML = "";
    if (!message) return;
    const div = document.createElement("div");
    div.className = "alert alert--" + type;
    div.textContent = message;
    el.alertRoot.appendChild(div);
    try {
      div.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (_) {}
    if (type === "success") {
      setTimeout(function () {
        if (div.parentNode) div.remove();
      }, 4500);
    }
  }

  function getSelectedClassId() {
    return el.classSelect.value || "";
  }

  function getSelectedClass() {
    return C.findClass(state, getSelectedClassId());
  }

  function persist() {
    if (!S.save(state)) {
      showAlert(
        "error",
        "Impossible d’enregistrer (quota navigateur ou mode privé). Libérez de l’espace ou désactivez le blocage des cookies."
      );
      return false;
    }
    return true;
  }

  function refreshClassSelect() {
    const prev = el.classSelect.value;
    el.classSelect.innerHTML = "";
    state.classes.forEach(function (c) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      el.classSelect.appendChild(opt);
    });
    if (state.classes.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— Aucune classe —";
      el.classSelect.appendChild(opt);
      el.classSelect.disabled = true;
    } else {
      el.classSelect.disabled = false;
      if (prev && state.classes.some(function (c) { return c.id === prev; })) {
        el.classSelect.value = prev;
      }
    }
  }

  function refreshAddGroupSelect() {
    const cls = getSelectedClass();
    el.addGroup.innerHTML = "";
    if (!cls) return;
    cls.groups.forEach(function (g, idx) {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = "Groupe " + (idx + 1) + " (" + g.students.length + "/" + MAX_STU + ")";
      el.addGroup.appendChild(opt);
    });
  }

  function closeModal() {
    el.modalRoot.hidden = true;
    el.modalRoot.innerHTML = "";
  }

  function openEditStudentModal(cls, grp, stu) {
    el.modalRoot.hidden = false;
    el.modalRoot.innerHTML = "";

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "edit-stu-title");

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML =
      '<h2 id="edit-stu-title">Modifier l’élève</h2>' +
      '<div class="form-row">' +
      '<div><label for="edit-nom">Nom</label><input type="text" id="edit-nom" /></div>' +
      '<div><label for="edit-prenom">Prénom</label><input type="text" id="edit-prenom" /></div>' +
      "</div>" +
      '<div class="form-row form-row--2">' +
      '<div><label for="edit-arrete">6 s départ arrêté</label><input type="number" id="edit-arrete" step="0.1" min="0" /></div>' +
      '<div><label for="edit-lance">6 s départ lancé</label><input type="number" id="edit-lance" step="0.1" min="0" /></div>' +
      "</div>";

    modal.querySelector("#edit-nom").value = stu.nom;
    modal.querySelector("#edit-prenom").value = stu.prenom;
    modal.querySelector("#edit-arrete").value = stu.perf6Arrete;
    modal.querySelector("#edit-lance").value = stu.perf6Lance;

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.className = "btn btn--secondary";
    btnCancel.textContent = "Annuler";

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.className = "btn btn--primary";
    btnSave.textContent = "Enregistrer";

    btnCancel.addEventListener("click", closeModal);
    backdrop.addEventListener("click", function (ev) {
      if (ev.target === backdrop) closeModal();
    });

    btnSave.addEventListener("click", function () {
      const nom = modal.querySelector("#edit-nom").value.trim();
      const prenom = modal.querySelector("#edit-prenom").value.trim();
      const a = parseFloat(String(modal.querySelector("#edit-arrete").value).replace(",", "."));
      const b = parseFloat(String(modal.querySelector("#edit-lance").value).replace(",", "."));
      if (!nom || !prenom) {
        showAlert("error", "Nom et prénom obligatoires.");
        return;
      }
      if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
        showAlert("error", "Indiquez des performances 6 s valides.");
        return;
      }
      stu.nom = nom;
      stu.prenom = prenom;
      stu.perf6Arrete = a;
      stu.perf6Lance = b;
      if (!persist()) return;
      closeModal();
      showAlert("success", "Élève mis à jour.");
      renderAll();
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    el.modalRoot.appendChild(backdrop);
    modal.querySelector("#edit-nom").focus();
  }

  function renderGroups() {
    const cls = getSelectedClass();
    el.groupsContainer.innerHTML = "";
    if (!cls) {
      el.groupsContainer.innerHTML = '<p class="text-muted" style="padding:1rem">Aucune classe à afficher.</p>';
      return;
    }

    const table = document.createElement("table");
    table.className = "students-table";
    table.innerHTML =
      "<thead><tr>" +
      "<th>Groupe</th>" +
      "<th>Nom</th>" +
      "<th>Prénom</th>" +
      "<th>6 s arrêté</th>" +
      "<th>6 s lancé</th>" +
      '<th class="students-table__actions">Actions</th>' +
      "</tr></thead>";
    const tb = document.createElement("tbody");

    cls.groups.forEach(function (g, gIdx) {
      if (g.students.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.className = "text-muted";
        td.style.padding = "0.75rem";
        td.textContent = "Groupe " + (gIdx + 1) + " — aucun élève.";
        tr.appendChild(td);
        tb.appendChild(tr);
        return;
      }
      g.students.forEach(function (stu, rowIdx) {
        const tr = document.createElement("tr");
        const tdG = document.createElement("td");
        if (rowIdx === 0) {
          tdG.textContent = "Groupe " + (gIdx + 1) + " (" + g.students.length + ")";
          tdG.rowSpan = Math.max(1, g.students.length);
          tdG.className = "students-table__groupcell";
        }
        const slotColor = C.getStudentColorInGroup(g, stu.id);
        const tdNom = document.createElement("td");
        const spanN = document.createElement("span");
        spanN.style.color = slotColor;
        spanN.style.fontWeight = "700";
        spanN.textContent = stu.nom;
        tdNom.appendChild(spanN);
        const tdPre = document.createElement("td");
        const spanP = document.createElement("span");
        spanP.style.color = slotColor;
        spanP.style.fontWeight = "700";
        spanP.textContent = stu.prenom;
        tdPre.appendChild(spanP);
        const tdA = document.createElement("td");
        tdA.textContent = String(stu.perf6Arrete);
        const tdB = document.createElement("td");
        tdB.textContent = String(stu.perf6Lance);
        const tdAct = document.createElement("td");
        tdAct.className = "students-table__actions";

        const btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.className = "btn-icon";
        btnEdit.setAttribute("aria-label", "Modifier " + stu.prenom + " " + stu.nom);
        btnEdit.title = "Modifier";
        btnEdit.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

        btnEdit.addEventListener("click", function () {
          openEditStudentModal(cls, g, stu);
        });

        const btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "btn-icon btn-icon--danger";
        btnDel.setAttribute("aria-label", "Supprimer " + stu.prenom + " " + stu.nom);
        btnDel.title = "Supprimer";
        btnDel.innerHTML = (window.EPSIcons && window.EPSIcons.trash) || "";
        btnDel.addEventListener("click", function () {
          if (!window.confirm("Supprimer " + stu.prenom + " " + stu.nom + " de ce groupe ?")) return;
          g.students = g.students.filter(function (s) { return s.id !== stu.id; });
          if (persist()) {
            showAlert("success", "Élève supprimé.");
            renderAll();
          }
        });

        tdAct.appendChild(btnEdit);
        tdAct.appendChild(btnDel);

        if (rowIdx === 0) {
          tr.appendChild(tdG);
        }
        tr.appendChild(tdNom);
        tr.appendChild(tdPre);
        tr.appendChild(tdA);
        tr.appendChild(tdB);
        tr.appendChild(tdAct);
        tb.appendChild(tr);
      });
    });

    table.appendChild(tb);
    el.groupsContainer.appendChild(table);
  }

  function renderAll() {
    refreshClassSelect();
    const cls = getSelectedClass();
    if (cls) {
      el.className.value = cls.name;
    } else {
      el.className.value = "";
    }
    refreshAddGroupSelect();
    renderGroups();
    updatePerfLink();
  }

  function updatePerfLink() {
    const a = document.getElementById("link-perf");
    if (!a) return;
    const id = getSelectedClassId();
    a.href = id ? "performance.html?class=" + encodeURIComponent(id) : "performance.html";
  }

  el.classSelect.addEventListener("change", function () {
    showAlert("", "");
    renderAll();
  });

  el.btnSaveClass.addEventListener("click", function () {
    const cls = getSelectedClass();
    if (!cls) {
      showAlert("error", "Aucune classe sélectionnée.");
      return;
    }
    const name = el.className.value.trim();
    if (!name) {
      showAlert("error", "Le nom de la classe ne peut pas être vide.");
      return;
    }
    cls.name = name;
    if (persist()) {
      showAlert("success", "Classe enregistrée.");
      refreshClassSelect();
      el.classSelect.value = cls.id;
    }
  });

  el.btnDeleteClass.addEventListener("click", function () {
    const cls = getSelectedClass();
    if (!cls) return;
    if (
      !window.confirm(
        "Supprimer définitivement la classe « " + cls.name + " » et toutes ses performances enregistrées ?"
      )
    ) {
      return;
    }
    state.classes = state.classes.filter(function (c) { return c.id !== cls.id; });
    state.performances = state.performances.filter(function (p) { return p.classId !== cls.id; });
    if (!persist()) return;
    showAlert("success", "Classe supprimée.");
    if (state.classes.length === 0) {
      state = S.seedSample();
      persist();
      showAlert("info", "Aucune classe restante : données d’exemple rechargées.");
    }
    renderAll();
  });

  el.btnImport.addEventListener("click", function () {
    let parsed;
    try {
      parsed = C.parseClassImport(el.importText.value);
    } catch (err) {
      showAlert("error", err.message || String(err));
      return;
    }
    const newClass = {
      id: S.uid(),
      name: parsed.name,
      groups: parsed.groups.map(function (g) {
        return {
          id: S.uid(),
          students: g.students.map(function (s) {
            return {
              id: S.uid(),
              nom: s.nom,
              prenom: s.prenom,
              perf6Arrete: s.perf6Arrete,
              perf6Lance: s.perf6Lance,
            };
          }),
        };
      }),
    };
    state.classes.push(newClass);
    if (!persist()) {
      state.classes.pop();
      return;
    }
    el.importText.value = "";
    el.classSelect.value = newClass.id;
    showAlert("success", "Classe « " + newClass.name + " » importée.");
    renderAll();
  });

  el.btnAddStudent.addEventListener("click", function () {
    const cls = getSelectedClass();
    if (!cls) {
      showAlert("error", "Sélectionnez une classe.");
      return;
    }
    const gid = el.addGroup.value;
    const grp = C.findGroup(cls, gid);
    if (!grp) {
      showAlert("error", "Groupe introuvable.");
      return;
    }
    if (grp.students.length >= MAX_STU) {
      showAlert(
        "error",
        "Ce groupe compte déjà " + MAX_STU + " élèves (maximum). Supprimez un élève ou choisissez un autre groupe."
      );
      return;
    }
    const nom = el.addNom.value.trim();
    const prenom = el.addPrenom.value.trim();
    const a = parseFloat(String(el.addArrete.value).replace(",", "."));
    const b = parseFloat(String(el.addLance.value).replace(",", "."));
    if (!nom || !prenom) {
      showAlert("error", "Nom et prénom obligatoires.");
      return;
    }
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
      showAlert("error", "Indiquez des performances 6 s valides (nombres positifs).");
      return;
    }
    grp.students.push({
      id: S.uid(),
      nom: nom,
      prenom: prenom,
      perf6Arrete: a,
      perf6Lance: b,
    });
    if (!persist()) return;
    el.addNom.value = "";
    el.addPrenom.value = "";
    el.addArrete.value = "";
    el.addLance.value = "";
    showAlert("success", "Élève ajouté au groupe.");
    renderAll();
  });

  renderAll();
})();
