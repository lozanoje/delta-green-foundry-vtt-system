// Import Modules
import { DeltaGreenActor } from "./actor/actor.js";
import { DeltaGreenActorSheet } from "./actor/actor-sheet.js";
import { DeltaGreenItem } from "./item/item.js";
import { DeltaGreenItemSheet } from "./item/item-sheet.js";

Hooks.once('init', async function() {

  game.deltagreen = {
    DeltaGreenActor,
    DeltaGreenItem,
    rollItemMacro
  };

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "@statistics.dex.value",
    decimals: 0
  };

  // Define custom Entity classes
  CONFIG.Actor.entityClass = DeltaGreenActor;
  CONFIG.Item.entityClass = DeltaGreenItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("deltagreen", DeltaGreenActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("deltagreen", DeltaGreenItemSheet, { makeDefault: true });

  // Add Handlebars helpers, here are a few useful examples:
  Handlebars.registerHelper('concat', function() {
    var outStr = '';
    for (var arg in arguments) {
      if (typeof arguments[arg] != 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  Handlebars.registerHelper('toLowerCase', function(str) {
    try {
      return str.toLowerCase();
    } catch (error) {
      return "";
    }
  });

  Handlebars.registerHelper('toUpperCase', function(str) {
    try {
      return str.toUpperCase();
    } catch (error) {
      return "";
    }
  });

  Handlebars.registerHelper('if_eq', function(a, b, opts) {
    if (a == b) {
        return opts.fn(this);
    } else {
        return opts.inverse(this);
    }
  });

  Handlebars.registerHelper('formatLethality', function(lethality) {
    if (lethality > 0) {
      return lethality.toString() + "%";
    }
    else {
      return "";
    }
  });

  Handlebars.registerHelper('getActorSkillProp', function(actorData, skillName, prop) {
    if(skillName != "" && prop != ""){
      let skills = actorData.skills;
      let skill = skills[skillName];
      let propVal = skill[prop];
      return propVal;
    }
    else{
      return "";
    }
  });
});

Hooks.once("ready", async function() {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createDeltaGreenMacro(data, slot));
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createDeltaGreenMacro(data, slot) {
  if (data.type !== "Item") return;
  if (!("data" in data)) return ui.notifications.warn("You can only create macro buttons for owned Items");
  const item = data.data;

  // Create the macro command
  const command = `game.deltagreen.rollItemMacro("${item.name}");`;
  let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "deltagreen.itemMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  const item = actor ? actor.items.find(i => i.name === itemName) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  return item.roll();
}