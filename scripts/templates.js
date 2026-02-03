/**
 * Templates base para criação de itens e atores no Daggerheart
 * Garante que todos os campos obrigatórios existam
 */

export const TEMPLATES = {

  // ============================================
  // WEAPONS
  // ============================================
  weapon: {
    name: "Weapon",
    type: "weapon",
    img: "systems/daggerheart/assets/icons/documents/items/battered-axe.svg",
    system: {
      attribution: {},
      description: "",
      actions: {},
      attached: [],
      tier: 1,
      equipped: false,
      secondary: false,
      burden: "oneHanded",
      weaponFeatures: [],
      attack: {
        name: "Attack",
        img: "icons/skills/melee/blood-slash-foam-red.webp",
        _id: "templateId",
        baseAction: true,
        chatDisplay: false,
        systemPath: "attack",
        type: "attack",
        range: "melee",
        target: {
          type: "any",
          amount: 1
        },
        roll: {
          trait: "agility",
          type: "attack",
          difficulty: null,
          bonus: null,
          advState: "neutral",
          diceRolling: {
            multiplier: "prof",
            flatMultiplier: 1,
            dice: "d6",
            compare: null,
            treshold: null
          },
          useDefault: false
        },
        damage: {
          parts: [
            {
              type: ["physical"],
              value: {
                multiplier: "prof",
                dice: "d8",
                flatMultiplier: 1,
                bonus: null,
                custom: {
                  enabled: false,
                  formula: ""
                }
              },
              applyTo: "hitPoints",
              resultBased: false,
              valueAlt: {
                multiplier: "prof",
                flatMultiplier: 1,
                dice: "d6",
                bonus: null,
                custom: {
                  enabled: false,
                  formula: ""
                }
              },
              base: false
            }
          ],
          includeBase: false,
          direct: false
        },
        description: "",
        originItem: {
          type: "itemCollection"
        },
        actionType: "action",
        triggers: [],
        cost: [],
        uses: {
          value: null,
          max: null,
          recovery: null,
          consumeOnSuccess: false
        },
        effects: [],
        save: {
          trait: null,
          difficulty: null,
          damageMod: "none"
        }
      },
      rules: {
        attack: {
          roll: {
            trait: null
          }
        }
      }
    },
    effects: [],
    flags: {}
  },

  // ============================================
  // ARMOR
  // ============================================
  armor: {
    name: "Armor",
    type: "armor",
    img: "systems/daggerheart/assets/icons/documents/items/chest-armor.svg",
    system: {
      attribution: {},
      description: "",
      actions: {},
      attached: [],
      tier: 1,
      equipped: false,
      baseScore: 0,
      armorFeatures: [],
      marks: {
        value: 0
      },
      baseThresholds: {
        major: 0,
        severe: 0
      }
    },
    effects: [],
    flags: {}
  },

  // ============================================
  // FEATURE
  // ============================================
  feature: {
    name: "Feature",
    type: "feature",
    img: "systems/daggerheart/assets/icons/documents/items/stars-stack.svg",
    system: {
      attribution: {},
      description: "",
      resource: null,
      actions: {},
      originItemType: null,
      multiclassOrigin: false,
      featureForm: "passive"
    },
    effects: [],
    flags: {}
  },

  // ============================================
  // DOMAIN CARD
  // ============================================
  domainCard: {
    name: "Domain Card",
    type: "domainCard",
    img: "systems/daggerheart/assets/icons/documents/items/card-play.svg",
    system: {
      attribution: {},
      description: "",
      resource: null,
      actions: {},
      domain: "arcana",
      level: 1,
      recallCost: 0,
      type: "ability",
      inVault: false,
      vaultActive: false,
      loadoutIgnore: false,
      domainTouched: null
    },
    effects: [],
    flags: {}
  },

  // ============================================
  // CONSUMABLE
  // ============================================
  consumable: {
    name: "Consumable",
    type: "consumable",
    img: "systems/daggerheart/assets/icons/documents/items/round-potion.svg",
    system: {
      attribution: {},
      description: "",
      quantity: 1,
      actions: {},
      consumeOnUse: true,
      destroyOnEmpty: true
    },
    effects: [],
    flags: {}
  },

  // ============================================
  // LOOT
  // ============================================
  loot: {
    name: "Loot",
    type: "loot",
    img: "systems/daggerheart/assets/icons/documents/items/open-treasure-chest.svg",
    system: {
      attribution: {},
      description: "",
      quantity: 1,
      actions: {}
    },
    effects: [],
    flags: {}
  },

  // ============================================
  // ADVERSARY (Actor)
  // ============================================
  adversary: {
    name: "Adversary",
    type: "adversary",
    img: "systems/daggerheart/assets/icons/documents/actors/dragon-head.svg",
    system: {
      attribution: {},
      description: "",
      resistance: {
        physical: {
          resistance: false,
          immunity: false,
          reduction: 0
        },
        magical: {
          resistance: false,
          immunity: false,
          reduction: 0
        }
      },
      size: "medium",
      tier: 1,
      type: "standard",
      notes: "",
      difficulty: 1,
      hordeHp: 1,
      criticalThreshold: 20,
      damageThresholds: {
        major: 0,
        severe: 0
      },
      resources: {
        hitPoints: {
          value: 0,
          max: 0,
          isReversed: true
        },
        stress: {
          value: 0,
          max: 0,
          isReversed: true
        }
      },
      rules: {
        conditionImmunities: {
          hidden: false,
          restrained: false,
          vulnerable: false
        },
        damageReduction: {
          thresholdImmunities: {
            minor: false
          },
          reduceSeverity: {
            magical: 0,
            physical: 0
          }
        },
        attack: {
          damage: {
            hpDamageMultiplier: 1,
            hpDamageTakenMultiplier: 1
          }
        }
      },
      attack: {
        name: "Attack",
        img: "icons/skills/melee/blood-slash-foam-red.webp",
        _id: "templateId",
        systemPath: "attack",
        chatDisplay: false,
        type: "attack",
        range: "melee",
        target: {
          type: "any",
          amount: 1
        },
        roll: {
          type: "attack",
          trait: null,
          difficulty: null,
          bonus: null,
          advState: "neutral",
          diceRolling: {
            multiplier: "prof",
            flatMultiplier: 1,
            dice: "d6",
            compare: null,
            treshold: null
          },
          useDefault: false
        },
        damage: {
          parts: [
            {
              type: ["physical"],
              value: {
                multiplier: "flat",
                flatMultiplier: 1,
                dice: "d6",
                bonus: null,
                custom: {
                  enabled: false,
                  formula: ""
                }
              },
              applyTo: "hitPoints",
              resultBased: false,
              valueAlt: {
                multiplier: "prof",
                flatMultiplier: 1,
                dice: "d6",
                bonus: null,
                custom: {
                  enabled: false,
                  formula: ""
                }
              },
              base: false
            }
          ],
          includeBase: false,
          direct: false
        },
        baseAction: false,
        description: "",
        originItem: {
          type: "itemCollection"
        },
        actionType: "action",
        triggers: [],
        cost: [],
        uses: {
          value: null,
          max: null,
          recovery: null,
          consumeOnSuccess: false
        },
        effects: [],
        save: {
          trait: null,
          difficulty: null,
          damageMod: "none"
        }
      },
      experiences: {},
      bonuses: {
        roll: {
          attack: {
            bonus: 0,
            dice: []
          },
          action: {
            bonus: 0,
            dice: []
          },
          reaction: {
            bonus: 0,
            dice: []
          }
        },
        damage: {
          physical: {
            bonus: 0,
            dice: []
          },
          magical: {
            bonus: 0,
            dice: []
          }
        }
      }
    },
    prototypeToken: {
      name: "Adversary",
      displayName: 0,
      actorLink: false,
      width: 1,
      height: 1,
      texture: {
        src: "systems/daggerheart/assets/icons/documents/actors/dragon-head.svg",
        anchorX: 0.5,
        anchorY: 0.5,
        offsetX: 0,
        offsetY: 0,
        fit: "contain",
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        tint: "#ffffff",
        alphaThreshold: 0.75
      },
      lockRotation: false,
      rotation: 0,
      alpha: 1,
      disposition: -1,
      displayBars: 0,
      bar1: {
        attribute: "resources.hitPoints"
      },
      bar2: {
        attribute: "resources.stress"
      },
      light: {
        negative: false,
        priority: 0,
        alpha: 0.5,
        angle: 360,
        bright: 0,
        color: null,
        coloration: 1,
        dim: 0,
        attenuation: 0.5,
        luminosity: 0.5,
        saturation: 0,
        contrast: 0,
        shadows: 0,
        animation: {
          type: null,
          speed: 5,
          intensity: 5,
          reverse: false
        },
        darkness: {
          min: 0,
          max: 1
        }
      },
      sight: {
        enabled: false,
        range: 0,
        angle: 360,
        visionMode: "basic",
        color: null,
        attenuation: 0.1,
        brightness: 0,
        saturation: 0,
        contrast: 0
      },
      detectionModes: [],
      occludable: {
        radius: 0
      },
      ring: {
        enabled: false,
        colors: {
          ring: null,
          background: null
        },
        effects: 1,
        subject: {
          scale: 1,
          texture: null
        }
      },
      flags: {},
      randomImg: false,
      appendNumber: false,
      prependAdjective: false
    },
    items: [],
    effects: [],
    flags: {}
  },

  // ============================================
  // ENVIRONMENT (Actor)
  // ============================================
  environment: {
    name: "Environment",
    type: "environment",
    img: "systems/daggerheart/assets/icons/documents/actors/forest.svg",
    system: {
      attribution: {},
      description: "",
      tier: 1,
      difficulty: 11,
      potentialAdversaries: {},
      notes: ""
    },
    prototypeToken: {
      name: "Environment",
      displayName: 0,
      actorLink: false,
      width: 1,
      height: 1,
      texture: {
        src: "systems/daggerheart/assets/icons/documents/actors/forest.svg",
        anchorX: 0.5,
        anchorY: 0.5,
        offsetX: 0,
        offsetY: 0,
        fit: "contain",
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        tint: "#ffffff",
        alphaThreshold: 0.75
      },
      lockRotation: false,
      rotation: 0,
      alpha: 1,
      disposition: -1,
      displayBars: 0,
      bar1: {
        attribute: "resources.hitPoints"
      },
      bar2: {
        attribute: "resources.stress"
      },
      light: {
        negative: false,
        priority: 0,
        alpha: 0.5,
        angle: 360,
        bright: 0,
        color: null,
        coloration: 1,
        dim: 0,
        attenuation: 0.5,
        luminosity: 0.5,
        saturation: 0,
        contrast: 0,
        shadows: 0,
        animation: {
          type: null,
          speed: 5,
          intensity: 5,
          reverse: false
        },
        darkness: {
          min: 0,
          max: 1
        }
      },
      sight: {
        enabled: false,
        range: 0,
        angle: 360,
        visionMode: "basic",
        color: null,
        attenuation: 0.1,
        brightness: 0,
        saturation: 0,
        contrast: 0
      },
      detectionModes: [],
      occludable: {
        radius: 0
      },
      ring: {
        enabled: false,
        colors: {
          ring: null,
          background: null
        },
        effects: 1,
        subject: {
          scale: 1,
          texture: null
        }
      },
      flags: {},
      randomImg: false,
      appendNumber: false,
      prependAdjective: false
    },
    items: [],
    effects: [],
    flags: {}
  }

};
