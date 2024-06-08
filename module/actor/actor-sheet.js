/* globals $ game Roll ChatMessage AudioHelper ActorSheet mergeObject Dialog TextEditor ActiveEffect ui duplicate fromUuidSync renderTemplate randomID */

import DG from "../config.js";
import {
  DGPercentileRoll,
  DGLethalityRoll,
  DGDamageRoll,
  DGSanityDamageRoll,
} from "../roll/roll.js";
/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export default class DeltaGreenActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["deltagreen", "sheet", "actor"],
      template: "systems/deltagreen/templates/actor/actor-sheet.html",
      width: 700,
      height: 770,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "skills",
        },
      ],
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    if (this.actor !== null) {
      if (this.actor.type === "agent") {
        if (!game.user.isGM && this.actor.limited) {
          return "systems/deltagreen/templates/actor/limited-sheet.html";
        }

        // return `systems/deltagreen/templates/actor/${this.actor.data.type}-sheet.html`;
        return `systems/deltagreen/templates/actor/actor-sheet.html`;
      }
      if (this.actor.type === "unnatural") {
        return `systems/deltagreen/templates/actor/unnatural-sheet.html`;
      }
      if (this.actor.type === "npc") {
        return `systems/deltagreen/templates/actor/npc-sheet.html`;
      }
      if (this.actor.type === "vehicle") {
        return `systems/deltagreen/templates/actor/vehicle-sheet.html`;
      }

      return "systems/deltagreen/templates/actor/limited-sheet.html";
    }

    return "systems/deltagreen/templates/actor/limited-sheet.html";
  }

  /** @override */
  async getData() {
    const data = super.getData();

    // Prepare items.
    if (this.actor.type === "agent") {
      this._prepareCharacterItems(data);
    }

    // Make it easy for the sheet handlebars to understand how to sort the skills.
    data.sortSkillsSetting = game.settings.get("deltagreen", "sortSkills");

    // Prepare a simplified version of the special training for display on sheet.
    if (this.actor.type !== "vehicle") {
      const specialTraining = this.actor.system.specialTraining.map(
        (training) => {
          const simplifiedTraining = {
            name: training.name,
            id: training.id,
            key: training.attribute,
          };
          // Convert the machine-readable name to a human-readable one.
          switch (true) {
            // Stats
            case DG.statistics.includes(training.attribute):
              simplifiedTraining.attribute = training.attribute.toUpperCase();
              simplifiedTraining.targetNumber =
                this.actor.system.statistics[training.attribute].value;
              break;
            // Skills
            case DG.skills.includes(training.attribute):
              simplifiedTraining.attribute =
                this.actor.system.skills[training.attribute].label;
              simplifiedTraining.targetNumber =
                this.actor.system.skills[training.attribute].proficiency;
              break;
            // Typed Skills
            default:
              simplifiedTraining.attribute =
                this.actor.system.typedSkills[training.attribute].label;
              simplifiedTraining.targetNumber =
                this.actor.system.typedSkills[training.attribute].proficiency;
              break;
          }
          return simplifiedTraining;
        },
      );
      data.specialTraining = specialTraining;
    }

    switch (this.actor.type) {
      case "agent":
        data.enrichedDescription = await TextEditor.enrichHTML(
          this.object.system.physicalDescription,
          { async: true },
        );
        break;
      case "vehicle":
        data.enrichedDescription = await TextEditor.enrichHTML(
          this.object.system.description,
          { async: true },
        );
        break;
      case "npc":
      case "unnatural":
        data.enrichedDescription = await TextEditor.enrichHTML(
          this.object.system.notes,
          { async: true },
        );
        break;
      default:
    }

    return data;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterItems(sheetData) {
    const actorData = sheetData.actor;

    // Initialize containers.
    const armor = [];
    const weapons = [];

    // Iterate through items, allocating to containers
    // let totalWeight = 0;
    for (const i of sheetData.items) {
      // Append to armor.
      if (i.type === "armor") {
        armor.push(i);
      }
      // Append to weapons.
      else if (i.type === "weapon") {
        weapons.push(i);
      }
    }

    // Assign and return
    actorData.armor = armor;
    actorData.weapons = weapons;
  }

  // Can add extra buttons to form header here if necessary
  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();
    let label = "Roll Luck";
    let label2 = "Luck";

    try {
      label = game.i18n.translations.DG.RollLuck;
      label2 = game.i18n.translations.DG.Luck;
    } catch {
      ui.notifications.warn(
        "Missing translation key for either DG.RollLuck or DG.Luck key.",
      );
    }

    buttons = [
      {
        label,
        class: "test-extra-icon",
        icon: "fas fa-dice",
        onclick: (ev) => this.luckRollOnClick(ev, this.actor, label2),
      },
    ].concat(buttons);

    return buttons;
  }

  // This only exists to give a chance to activate the modifier dialogue if desired
  // Cannot seem to trigger the event on a right-click, so unfortunately only applies to a shift-click currently.
  async luckRollOnClick(event) {
    if (event && event.which === 2) {
      // probably don't want rolls to trigger from a middle mouse click so just kill it here
      return;
    }
    const rollOptions = {
      rollType: "luck",
      key: "luck",
      actor: this.actor,
    };

    // Create a default 1d100 roll just in case.
    const roll = new DGPercentileRoll("1D100", {}, rollOptions);
    // Open dialog if user requests it.
    if (event.shiftKey || event.which === 3) {
      const dialogData = await roll.showDialog();
      if (!dialogData) return;
      roll.modifier += dialogData.targetModifier;
      roll.options.rollMode = dialogData.rollMode;
    }
    // Evaluate the roll.
    await roll.evaluate({ async: true });
    // Send the roll to chat.
    roll.toChat();
  }

  activeEffectTest(sheet) {
    console.log(sheet.actor.uuid);
    const owner = sheet.actor;

    const effect = ActiveEffect.create(
      {
        label: "Custom Effect",
        tint: "#008000",
        icon: "icons/svg/aura.svg",
        origin: owner.uuid,
        // duration: {"rounds": 1, "seconds": null, "startTime": null, "turns": null, "startRound": null, "startTurn": null},
        disabled: false,
        changes: [
          {
            key: "data.skills.firearms.proficiency", // "data.statistics.str.value", //"data.health.max",
            mode: 2, // 0 = custom, 1 = multiply, 2 = add, 3 = upgrade, 4 = downgrade, 5 = override
            value: -20,
            priority: "20",
          },
        ],
      },
      owner,
    ).create();
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Inventory Item
    html.find(".item-create").click(this._onItemCreate.bind(this));

    // Update Inventory Item
    html.find(".item-edit").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      // const item = this.actor.getOwnedItem(li.data("itemId"));
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find(".item-delete").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");

      // this.actor.deleteOwnedItem(li.data("itemId"));
      const options = {};
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")], options);

      li.slideUp(200, () => this.render(false));
    });

    // Rollable abilities - bind to everything with the 'Rollable' class
    html.find(".rollable").click(this._onRoll.bind(this));
    html.find(".rollable").contextmenu(this._onRoll.bind(this)); // this is for right-click, which triggers the roll modifier dialogue for most rolls

    html.find(".toggle-untrained").click(() =>
      this.actor.update({
        "system.showUntrainedSkills": !this.actor.system.showUntrainedSkills,
      }),
    );

    // Macro for toggling an item's equipped state
    html
      .find(".equipped-item")
      .mousedown(this._onEquippedStatusChange.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      const handler = (ev) => this._onDragStart(ev);
      html.find("li.item").each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }

    // Custom Sheet Macros
    html.find(".btn-reset-breaking-point").click((event) => {
      event.preventDefault();
      let currentBreakingPoint = 0;

      currentBreakingPoint =
        this.actor.system.sanity.value - this.actor.system.statistics.pow.value;

      const updatedData = duplicate(this.actor.system);
      updatedData.sanity.currentBreakingPoint = currentBreakingPoint;
      this.actor.update({ data: updatedData });
    });

    html.find(".typed-skill-add").click((event) => {
      event.preventDefault();

      const targetskill = event.target.getAttribute("data-typeskill");

      this._showNewTypeSkillDialog(targetskill);
    });

    html.find(".typed-skill-edit").click((event) => {
      event.preventDefault();
      const targetskill = event.target.getAttribute("data-typedskill");
      const existingLabel = this.actor.system.typedSkills[targetskill].label;
      const existingGroup = this.actor.system.typedSkills[targetskill].group;

      // this.actor.update({[`data.typedSkills.${targetskill}.label`]: 'test'});

      this._showNewEditTypeSkillDialog(
        targetskill,
        existingLabel,
        existingGroup,
      );
    });

    html.find(".typed-skill-delete").click((event) => {
      event.preventDefault();
      const targetskill = event.target.getAttribute("data-typedskill");

      // many bothans died to bring us this information on how to delete a property on an entity
      this.actor.update({ [`system.typedSkills.-=${targetskill}`]: null });
    });

    html.find(".special-training-action").click((event) => {
      event.preventDefault();
      const action = event.currentTarget.getAttribute("data-action");
      const targetID = event.currentTarget.getAttribute("data-id");
      this._showSpecialTrainingDialog(action, targetID);
    });

    // Handle deletion of Special Training
    html.find(".special-training-delete").click((event) => {
      event.preventDefault();
      const targetID = event.target.getAttribute("data-id");
      const specialTrainingArray = duplicate(this.actor.system.specialTraining);
      // Get the index of the training to be deleted
      const index = specialTrainingArray.findIndex(
        (training) => training.id === targetID,
      );

      specialTrainingArray.splice(index, 1);
      this.actor.update({ "system.specialTraining": specialTrainingArray });
    });

    html.find(".apply-skill-improvements").click((event) => {
      event.preventDefault();

      const failedSkills = Object.entries(this.actor.system.skills).filter(
        (skill) => skill[1].failure,
      );
      const failedTypedSkills = Object.entries(
        this.actor.system.typedSkills,
      ).filter((skill) => skill[1].failure);
      if (failedSkills.length === 0 && failedTypedSkills.length === 0) {
        ui.notifications.warn("No Skills to Increase");
        return;
      }

      let htmlContent = "";
      let failedSkillNames = "";
      failedSkills.forEach(([skill], value) => {
        if (value === 0) {
          failedSkillNames += game.i18n.localize(`DG.Skills.${skill}`);
        } else {
          failedSkillNames += `, ${game.i18n.localize(`DG.Skills.${skill}`)}`;
        }
      });
      failedTypedSkills.forEach(([skillName, skillData], value) => {
        if (value === 0 && failedSkillNames === "") {
          failedSkillNames += `${game.i18n.localize(
            `DG.TypeSkills.${skillData.group.split(" ").join("")}`,
          )} (${skillData.label})`;
        } else {
          failedSkillNames += `, ${game.i18n.localize(
            `DG.TypeSkills.${skillData.group.split(" ").join("")}`,
          )} (${skillData.label})`;
        }
      });

      const baseRollFormula = game.settings.get(
        "deltagreen",
        "skillImprovementFormula",
      );

      htmlContent += `<div>`;
      htmlContent += `     <label>${game.i18n.localize(
        "DG.Skills.ApplySkillImprovementsDialogLabel",
      )} <b>+${baseRollFormula}%</b></label>`;
      htmlContent += `     <hr>`;
      htmlContent += `     <span> ${game.i18n.localize(
        "DG.Skills.ApplySkillImprovementsDialogEffectsFollowing",
      )} <b>${failedSkillNames}</b> </span>`;
      htmlContent += `</div>`;

      new Dialog({
        content: htmlContent,
        title:
          game.i18n.translations.DG?.Skills?.ApplySkillImprovements ??
          "Apply Skill Improvements",
        default: "add",
        buttons: {
          apply: {
            label: game.i18n.translations.DG?.Skills?.Apply ?? "Apply",
            callback: (btn) => {
              this._applySkillImprovements(
                baseRollFormula,
                failedSkills,
                failedTypedSkills,
              );
            },
          },
        },
      }).render(true);
    });

    // Browse Weapon Compendiums
    html.find(".weapon-browse").click((ev) => {
      const dialog = new Dialog({
        title: "Select Compendium",
        buttons: {
          firearms: {
            icon: '<i class="fas fa-crosshairs"></i>',
            callback: () =>
              game.packs
                .find((k) => k.collection === "deltagreen.firearms")
                .render(true),
          },
          melee: {
            icon: '<i class="far fa-hand-rock"></i>',
            callback: () =>
              game.packs
                .find((k) => k.collection === "deltagreen.hand-to-hand-weapons")
                .render(true),
          },
        },
      });

      dialog.render(true);
    });

    html.find(".armor-browse").click((ev) => {
      game.packs.find((k) => k.collection === "deltagreen.armor").render(true);
    });

    html.find(".gear-browse").click((ev) => {
      // game.packs.find(k=>k.collection==="deltagreen.firearms").render(true);
    });

    html.find(".toggle-lethality").click((event) => {
      this._toggleLethality(event);
    });

    // let user check off the 'bond damaged' checkbox right from the sheet
    html.find(".bond-has-been-damaged-agent-sheet-checkbox").click((ev) => {
      const el = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(el.data("item-id"));
      const value = ev.target.checked;

      item.update({ "system.hasBeenDamagedSinceLastHomeScene": value });
    });

    html.find(".clear-all-bond-damage-checks").click((ev) => {
      this._updateBondsRemoveAllDamagedCheckmarks();
    });
  }

  // trigger an update on all bonds that have had their damaged flag checked off
  async _updateBondsRemoveAllDamagedCheckmarks() {
    for (const i of this.actor.items) {
      if (i.type === "bond" && i.system.hasBeenDamagedSinceLastHomeScene) {
        await i.update({ "system.hasBeenDamagedSinceLastHomeScene": false });
      }
    }
  }

  _toggleLethality(event) {
    const itemId = event.target.getAttribute("item-id");
    const isLethal = event.target.getAttribute("is-lethal") === "true";
    const item = this.actor.items.find((i) => i.id === itemId);
    item.update({ "data.isLethal": !isLethal });
  }

  _showNewEditTypeSkillDialog(targetSkill, currentLabel, currentGroup) {
    // TO DO: BUILD DIALOG TO CAPTURE UPDATED DATA

    let htmlContent = `<div>`;
    htmlContent += `     <label>${
      game.i18n.translations.DG?.Skills?.SkillGroup ?? "Skill Group"
    }:</label>`;
    htmlContent += `     <select name="new-type-skill-group" />`;

    if (currentGroup === game.i18n.translations.DG?.TypeSkills?.Art ?? "Art") {
      htmlContent += `          <option selected>${
        game.i18n.translations.DG?.TypeSkills?.Art ?? "Art"
      }</option>`;
    } else {
      htmlContent += `          <option>${
        game.i18n.translations.DG?.TypeSkills?.Art ?? "Art"
      }</option>`;
    }

    if (
      currentGroup === game.i18n.translations.DG?.TypeSkills?.Craft ??
      "Craft"
    ) {
      htmlContent += `          <option selected>${
        game.i18n.translations.DG?.TypeSkills?.Craft ?? "Craft"
      }</option>`;
    } else {
      htmlContent += `          <option>${
        game.i18n.translations.DG?.TypeSkills?.Craft ?? "Craft"
      }</option>`;
    }

    if (
      currentGroup === game.i18n.translations.DG?.TypeSkills?.ForeignLanguage ??
      "Foreign Language"
    ) {
      htmlContent += `          <option selected>${
        game.i18n.translations.DG?.TypeSkills?.ForeignLanguage ??
        "Foreign Language"
      }</option>`;
    } else {
      htmlContent += `          <option>${
        game.i18n.translations.DG?.TypeSkills?.ForeignLanguage ??
        "Foreign Language"
      }</option>`;
    }

    if (
      currentGroup === game.i18n.translations.DG?.TypeSkills?.MilitaryScience ??
      "Military Science"
    ) {
      htmlContent += `          <option selected>${
        game.i18n.translations.DG?.TypeSkills?.MilitaryScience ??
        "Military Science"
      }</option>`;
    } else {
      htmlContent += `          <option>${
        game.i18n.translations.DG?.TypeSkills?.MilitaryScience ??
        "Military Science"
      }</option>`;
    }

    if (
      currentGroup === game.i18n.translations.DG?.TypeSkills?.Pilot ??
      "Pilot"
    ) {
      htmlContent += `          <option selected>${
        game.i18n.translations.DG?.TypeSkills?.Pilot ?? "Pilot"
      }</option>`;
    } else {
      htmlContent += `          <option>${
        game.i18n.translations.DG?.TypeSkills?.Pilot ?? "Pilot"
      }</option>`;
    }

    if (
      currentGroup === game.i18n.translations.DG?.TypeSkills?.Science ??
      "Science"
    ) {
      htmlContent += `          <option selected>${
        game.i18n.translations.DG?.TypeSkills?.Science ?? "Science"
      }</option>`;
    } else {
      htmlContent += `          <option>${
        game.i18n.translations.DG?.TypeSkills?.Science ?? "Science"
      }</option>`;
    }

    if (
      currentGroup === game.i18n.translations.DG?.TypeSkills?.Other ??
      "Other"
    ) {
      htmlContent += `          <option selected>${
        game.i18n.translations.DG?.TypeSkills?.Other ?? "Other"
      }</option>`;
    } else {
      htmlContent += `          <option>${
        game.i18n.translations.DG?.TypeSkills?.Other ?? "Other"
      }</option>`;
    }

    htmlContent += `     </select>`;
    htmlContent += `</div>`;

    htmlContent += `<div>`;
    htmlContent += `     <label>${
      game.i18n.translations.DG?.Skills.SkillName ?? "Skill Name"
    }</label>`;
    htmlContent += `     <input type="text" name="new-type-skill-label" value="${currentLabel}" />`;
    htmlContent += `</div>`;

    new Dialog({
      content: htmlContent,
      title:
        game.i18n.translations.DG?.Skills?.EditTypedOrCustomSkill ??
        "Edit Typed or Custom Skill",
      default: "add",
      buttons: {
        add: {
          label: game.i18n.translations.DG?.Skills?.EditSkill ?? "Edit Skill",
          callback: (btn) => {
            const newTypeSkillLabel = btn
              .find("[name='new-type-skill-label']")
              .val();
            const newTypeSkillGroup = btn
              .find("[name='new-type-skill-group']")
              .val();
            this._updateTypedSkill(
              targetSkill,
              newTypeSkillLabel,
              newTypeSkillGroup,
            );
          },
        },
      },
    }).render(true);
  }

  _showNewTypeSkillDialog(targetskill) {
    let htmlContent = "";

    htmlContent += `<div>`;
    htmlContent += `     <label>${
      game.i18n.translations.DG?.Skills?.SkillGroup ?? "Skill Group"
    }:</label>`;
    htmlContent += `     <select name="new-type-skill-group" />`;
    htmlContent += `          <option>${
      game.i18n.translations.DG?.TypeSkills?.Art ?? "Art"
    }</option>`;
    htmlContent += `          <option>${
      game.i18n.translations.DG?.TypeSkills?.Craft ?? "Craft"
    }</option>`;
    htmlContent += `          <option>${
      game.i18n.translations.DG?.TypeSkills?.ForeignLanguage ??
      "Foreign Language"
    }</option>`;
    htmlContent += `          <option>${
      game.i18n.translations.DG?.TypeSkills?.MilitaryScience ??
      "Military Science"
    }</option>`;
    htmlContent += `          <option>${
      game.i18n.translations.DG?.TypeSkills?.Pilot ?? "Pilot"
    }</option>`;
    htmlContent += `          <option>${
      game.i18n.translations.DG?.TypeSkills?.Science ?? "Science"
    }</option>`;
    htmlContent += `          <option>${
      game.i18n.translations.DG?.TypeSkills?.Other ?? "Other"
    }</option>`;
    htmlContent += `     </select>`;
    htmlContent += `</div>`;

    htmlContent += `<div>`;
    htmlContent += `     <label>${
      game.i18n.translations.DG?.Skills.SkillName ?? "Skill Name"
    }</label>`;
    htmlContent += `     <input type="text" name="new-type-skill-label" />`;
    htmlContent += `</div>`;

    new Dialog({
      content: htmlContent,
      title:
        game.i18n.translations.DG?.Skills?.AddTypedOrCustomSkill ??
        "Add Typed or Custom Skill",
      default: "add",
      buttons: {
        add: {
          label: game.i18n.translations.DG?.Skills?.AddSkill ?? "Add Skill",
          callback: (btn) => {
            const newTypeSkillLabel = btn
              .find("[name='new-type-skill-label']")
              .val();
            const newTypeSkillGroup = btn
              .find("[name='new-type-skill-group']")
              .val();
            this._addNewTypedSkill(newTypeSkillLabel, newTypeSkillGroup);
          },
        },
      },
    }).render(true);
  }

  _addNewTypedSkill(newSkillLabel, newSkillGroup) {
    const updatedData = duplicate(this.actor.system);
    const { typedSkills } = updatedData;

    const d = new Date();

    const newSkillPropertyName =
      d.getFullYear().toString() +
      (d.getMonth() + 1).toString() +
      d.getDate().toString() +
      d.getHours().toString() +
      d.getMinutes().toString() +
      d.getSeconds().toString();
    // console.log(newSkillPropertyName);
    typedSkills[newSkillPropertyName] = {
      label: newSkillLabel,
      group: newSkillGroup,
      proficiency: 10,
      failure: false,
    };

    updatedData.typedSkills = typedSkills;

    this.actor.update({ data: updatedData });
  }

  _updateTypedSkill(targetSkill, newSkillLabel, newSkillGroup) {
    if (
      newSkillLabel !== null &&
      newSkillLabel !== "" &&
      newSkillGroup !== null &&
      newSkillGroup !== ""
    ) {
      const updatedData = duplicate(this.actor.system);

      updatedData.typedSkills[targetSkill].label = newSkillLabel;
      updatedData.typedSkills[targetSkill].group = newSkillGroup;

      this.actor.update({ data: updatedData });
    }
  }

  async _showSpecialTrainingDialog(action, targetID) {
    const specialTraining = this.actor.system.specialTraining.find(
      (training) => training.id === targetID,
    );

    // Define the option groups for our drop-down menu.
    const optionGroups = {
      stats: game.i18n.localize(
        "DG.SpecialTraining.Dialog.DropDown.Statistics",
      ),
      skills: game.i18n.localize("DG.SpecialTraining.Dialog.DropDown.Skills"),
      typedSkills: game.i18n.localize(
        "DG.SpecialTraining.Dialog.DropDown.CustomSkills",
      ),
    };

    // Prepare simplified stat list
    const statList = Object.entries(this.actor.system.statistics).map(
      ([key, stat]) => ({
        value: key,
        group: optionGroups.stats,
        label: game.i18n.localize(`DG.Attributes.${key}`),
        targetNumber: stat.value * 5,
      }),
    );

    // Prepare simplified skill list
    const skillList = Object.entries(this.actor.system.skills).map(
      ([key, skill]) => ({
        value: key,
        group: optionGroups.skills,
        label: skill.label,
        targetNumber: skill.proficiency,
      }),
    );

    // Prepare simplified typed/custom skill list
    const typedSkillList = Object.entries(this.actor.system.typedSkills).map(
      ([key, skill]) => ({
        value: key,
        group: optionGroups.typedSkills,
        label: `${skill.group} (${skill.label})`,
        targetNumber: skill.proficiency,
      }),
    );

    // Prepare the Select element
    const selectElement = foundry.applications.fields.createSelectInput({
      name: "special-training-skill",
      options: [...statList, ...skillList, ...typedSkillList],
      groups: Object.values(optionGroups),
    }).outerHTML;

    // Prepare the template to feed to Dialog.
    const content = await renderTemplate(
      "systems/deltagreen/templates/dialog/special-training.html",
      {
        name: specialTraining?.name || "",
        selectElement,
        currentAttribute: specialTraining?.attribute || "",
        statList,
        skillList,
        typedSkillList,
      },
    );

    const buttonLabel = game.i18n.localize(
      `DG.SpecialTraining.Dialog.${action}SpecialTraining`,
    );

    // Prepare and render dialog with above template.
    new Dialog({
      content,
      title: game.i18n.localize("DG.SpecialTraining.Dialog.Title"),
      default: "confirm",
      buttons: {
        confirm: {
          label: buttonLabel,
          callback: (btn) => {
            const specialTrainingLabel = btn
              .find("[name='special-training-label']")
              .val();
            const specialTrainingAttribute = btn
              .find("[name='special-training-skill']")
              .val();
            if (action === "Create")
              this._createSpecialTraining(
                specialTrainingLabel,
                specialTrainingAttribute,
              );
            if (action === "Edit")
              this._editSpecialTraining(
                specialTrainingLabel,
                specialTrainingAttribute,
                targetID,
              );
          },
        },
      },
    }).render(true);
  }

  _createSpecialTraining(label, attribute) {
    const specialTrainingArray = duplicate(this.actor.system.specialTraining);
    specialTrainingArray.push({
      name: label,
      attribute,
      id: randomID(),
    });
    this.actor.update({ "system.specialTraining": specialTrainingArray });
  }

  _editSpecialTraining(label, attribute, id) {
    const specialTrainingArray = duplicate(this.actor.system.specialTraining);
    const specialTraining = specialTrainingArray.find(
      (training) => training.id === id,
    );
    specialTraining.name = label;
    specialTraining.attribute = attribute;
    this.actor.update({ "system.specialTraining": specialTrainingArray });
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemCreate(event) {
    event.preventDefault();

    const header = event.currentTarget;

    // Get the type of item to create.
    const { type } = header.dataset;

    // Initialize a default name.
    // const name = `New ${type.capitalize()}`;
    const name = game.i18n.format(
      game.i18n.translations.DOCUMENT?.New || "DG.FallbackText.newItem",
      {
        type: game.i18n.localize(`TYPES.Item.${type}`),
      },
    );

    // Prepare the item object.
    const itemData = {
      name,
      type,
      system: {},
    };

    if (type === "weapon") {
      // itemData.system.skill = "firearms"; //default skill to firearms, since that will be most common
      // itemData.system.expense = "Standard";
    } else if (type === "armor") {
      // itemData.system.armor = 3;
      // itemData.system.expense = "Standard";
    } else if (type === "bond") {
      // try to default bonds for an agent to their current CHA
      itemData.system.score = this.object.system.statistics.cha.value; // Can vary, but at character creation starting bond score is usually agent's charisma
      // itemData.img = "icons/svg/mystery-man.svg"
    }

    // create the item
    return this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  /**
   * Handle clickable rolls.
   *
   * @param {Event} event   The originating click event
   * @async
   * @private
   */
  async _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const { dataset } = element;

    if (event && event.which === 2) {
      // probably don't want rolls to trigger from a middle mouse click so just kill it here
      return;
    }

    const item = this.actor.items.get(dataset.iid);
    const rollOptions = {
      rollType: dataset.rolltype,
      key: dataset.key,
      actor: this.actor,
      specialTrainingName: dataset?.name || null, // Only applies to Special Training Rolls
      item,
    };

    // Create a default 1d100 roll just in case.
    let roll = new Roll("1d100", {});
    switch (dataset.rolltype) {
      case "stat":
      case "skill":
      case "sanity":
      case "special-training":
      case "weapon":
        roll = new DGPercentileRoll("1D100", {}, rollOptions);
        break;
      case "lethality":
        roll = new DGLethalityRoll("1D100", {}, rollOptions);
        break;
      case "damage": {
        let diceFormula = item.system.damage;
        const { skill } = item.system;
        if (
          this.actor.type === "agent" &&
          (skill === "unarmed_combat" || skill === "melee_weapons")
        ) {
          diceFormula +=
            this.actor.system.statistics.str.meleeDamageBonusFormula;
        }
        roll = new DGDamageRoll(diceFormula, {}, rollOptions);
        break;
      }
      case "sanity-damage": {
        const { successLoss, failedLoss } = this.actor.system.sanity;
        const combinedFormula = `{${successLoss}, ${failedLoss}}`;
        roll = new DGSanityDamageRoll(combinedFormula, {}, rollOptions);
        break;
      }
      default:
        break;
    }
    this.processRoll(event, roll, rollOptions);
  }

  /**
   * Show a dialog for the roll and then send to chat.
   * Broke this logic out from `_onRoll()` so that other files can call it,
   * namely the macro logic.
   *
   * TODO: Move this logic to the roll.js.
   *
   * @param {Event} event   The originating click event
   * @param {Event} roll   The roll to show a dialog for and then send to chat.
   * @async
   */
  async processRoll(event, roll) {
    // Open dialog if user requests it (no dialog for Sanity Damage rolls)
    if (
      (event.shiftKey || event.which === 3) &&
      !(roll instanceof DGSanityDamageRoll)
    ) {
      const dialogData = await roll.showDialog();
      if (!dialogData) return;
      if (dialogData.newFormula) {
        roll = new DGDamageRoll(dialogData.newFormula, {}, roll.options);
      }
      roll.modifier += dialogData.targetModifier;
      roll.options.rollMode = dialogData.rollMode;
    }
    // Evaluate the roll.
    await roll.evaluate();
    // Send the roll to chat.
    roll.toChat();
  }

  _resetBreakingPoint(event) {
    event.preventDefault();

    let currentBreakingPoint = 0;

    currentBreakingPoint =
      this.actor.system.sanity.value - this.actor.system.statistics.pow.value;

    if (currentBreakingPoint < 0) {
      currentBreakingPoint = 0;
    }

    const updatedData = duplicate(this.actor.system);

    updatedData.sanity.currentBreakingPoint = currentBreakingPoint;

    this.actor.update({ data: updatedData });
  }

  _onEquippedStatusChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const { dataset } = element;

    try {
      // const item = this.actor.getOwnedItem(dataset.id);
      const item = this.actor.items.get(dataset.id);
      let isEquipped = item.system.equipped;
      isEquipped = !isEquipped;
      item.update({ data: { equipped: isEquipped } });
    } catch (ex) {
      console.log(ex);
    }
  }

  // For any skills a user has checked off as failed, roll the improvement and update the agent's skills to their new values
  async _applySkillImprovements(
    baseRollFormula,
    failedSkills,
    failedTypedSkills,
  ) {
    const actorData = this.actor.system;
    const resultList = [];
    let rollFormula;

    // Define the amount of dice being rolled, if any.
    switch (baseRollFormula) {
      case "1":
        rollFormula = 1;
        break;
      case "1d3":
        rollFormula = `${failedSkills.length + failedTypedSkills.length}d3`;
        break;
      case "1d4":
      case "1d4-1":
        rollFormula = `${failedSkills.length + failedTypedSkills.length}d4`;
        break;
      default:
    }

    let roll;
    if (rollFormula !== 1) {
      roll = new Roll(rollFormula, actorData);
      roll.evaluate({ async: true });
      // Put the results into a list.
      roll.terms[0].results.forEach((result) =>
        resultList.push(
          baseRollFormula === "1d4-1" ? result.result - 1 : result.result,
        ),
      );
    }

    // This will be end up being a list of skills and how much each were improved by. It gets modified in the following loops.
    let improvedSkillList = "";

    // Get copy of current system data, will update this and then apply all changes at once synchronously at the end.
    const updatedData = duplicate(actorData);

    failedSkills.forEach(([skill], value) => {
      updatedData.skills[skill].proficiency += resultList[value] ?? 1; // Increase proficiency by die result or by 1 if there is no dice roll.
      updatedData.skills[skill].failure = false;

      // So we can record the regular skills improved and how much they were increased by in chat.
      // The if statement tells us whether to add a comma before the term or not.
      if (value === 0) {
        improvedSkillList += `${game.i18n.localize(
          `DG.Skills.${skill}`,
        )}: <b>+${resultList[value] ?? 1}%</b>`;
      } else {
        improvedSkillList += `, ${game.i18n.localize(
          `DG.Skills.${skill}`,
        )}: <b>+${resultList[value] ?? 1}%</b>`;
      }
    });

    failedTypedSkills.forEach(([skillName, skillData], value) => {
      // We must increase value in the following line by the length of failedSkills, so that we index the entire resultList.
      // Otherwise we would be adding the same die results to regular skills and typed skills.
      updatedData.typedSkills[skillName].proficiency +=
        resultList[value + failedSkills.length] ?? 1;
      updatedData.typedSkills[skillName].failure = false;

      // So we can record the typed skills improved and how much they were increased by in chat.
      // The if statement tells us whether to add a comma before the term or not.
      if (value === 0 && improvedSkillList === "") {
        improvedSkillList += `${game.i18n.localize(
          `DG.TypeSkills.${skillData.group.split(" ").join("")}`,
        )} (${skillData.label}): <b>+${
          resultList[value + failedSkills.length] ?? 1
        }%</b>`;
      } else {
        improvedSkillList += `, ${game.i18n.localize(
          `DG.TypeSkills.${skillData.group.split(" ").join("")}`,
        )} (${skillData.label}): <b>+${
          resultList[value + failedSkills.length] ?? 1
        }%</b>`;
      }
    });

    // Probably not worth triggering the update if the user didn't pick any skills
    if (improvedSkillList !== "") {
      await this.actor.update({ system: updatedData });
    }

    let html;
    html = `<div class="dice-roll">`;
    html += `  <div>${improvedSkillList}</div>`;
    html += `</div>`;

    const chatData = {
      speaker: ChatMessage.getSpeaker({
        actor: this.actor,
        token: this.token,
        alias: this.actor.name,
      }),
      content: html,
      flavor: `${game.i18n.localize(
        "DG.Skills.ApplySkillImprovementsChatFlavor",
      )} <b>+${baseRollFormula}%</b>:`,
      type: baseRollFormula === "1" ? 0 : 5, // 0 = CHAT_MESSAGE_TYPES.OTHER, 5 = CHAT_MESSAGE_TYPES.ROLL
      rolls: baseRollFormula === "1" ? [] : [roll], // If adding flat +1, there is no roll.
      rollMode: game.settings.get("core", "rollMode"),
    };

    // play the dice rolling sound, like a regular in-chat roll
    if (roll)
      AudioHelper.play(
        { src: "sounds/dice.wav", volume: 0.8, autoplay: true, loop: false },
        true,
      );

    ChatMessage.create(chatData, {});
  }

  /** @override */
  _onDragStart(event) {
    // Most of this is the standard Foundry implementation of _onDragStart
    const li = event.currentTarget;
    if (event.target.classList.contains("content-link")) return;

    // Create drag data
    let dragData;

    // Owned Items
    if (li.dataset.itemId) {
      const item = this.actor.items.get(li.dataset.itemId);
      dragData = item.toDragData();
    }

    // Active Effect
    if (li.dataset.effectId) {
      const effect = this.actor.effects.get(li.dataset.effectId);
      dragData = effect.toDragData();
    }

    if (!dragData) return;

    // this is custom, grab item data for creating item macros on the hotbar
    if (li.dataset.itemId) {
      const item = this.actor.items.get(li.dataset.itemId);
      dragData.itemData = item;
    }

    // Set data transfer
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /** @override */
  async _onDrop(event) {
    super._onDrop(event);
    // If alt key is held down, we will delete the original document.
    if (event.altKey) {
      // This is from Foundry. It will get the item data from the event.
      const dragData = TextEditor.getDragEventData(event);
      // Make sure that we are dragging an item, otherwise this doesn't make sense.
      if (dragData.type === "Item") {
        const item = fromUuidSync(dragData.uuid);
        await item.delete();
      }
    }
  }

  activateEditor(target, editorOptions, initialContent) {
    editorOptions.content_css = "./systems/deltagreen/css/editor.css";
    return super.activateEditor(target, editorOptions, initialContent);
  }
}
