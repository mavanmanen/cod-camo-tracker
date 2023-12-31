import { defineStore } from 'pinia'
import { DataRoot, Weapon } from '@/models'
import * as cfg from '@/assets/config.json'
import { computed, ref, watch } from 'vue'

const dataKey = 'savedata'

export const useDataStore = defineStore('datastore', () => {
  // State
  const config = ref(cfg)
  const selectedGameIndex = ref(0)
  const selectedModeIndex = ref(0)
  const data = ref<DataRoot>()
  const toggleStates = ref<Map<number, boolean>>()

  // Getters
  const selectedGame = computed(() => config.value.games[selectedGameIndex.value])
  const selectedMode = computed(() => selectedGame.value.supportedModes[selectedModeIndex.value])
  const weaponTypes = computed(() => data.value!.progress.get(selectedGame.value.name)!)
  const camos = computed(() => selectedMode.value.camos)
  const weapons = computed(() => [...weaponTypes.value.values()].flatMap(w => w))

  // Actions
  function replacer(key: string, value: any) {
    if(value instanceof Map) {
      return { 
        dataType: 'Map',
        value: [...value]
      }
    }
  
    return value
  }

  function reviver(key: string, value: any) {
    if(typeof value === 'object' && value !== null) {
      if(value.dataType === 'Map') {
        return new Map(value.value)
      }
    }
  
    return value
  }

  function loadData() {
    const raw = localStorage.getItem(dataKey)

    if(raw == null) {
      data.value = new DataRoot(config.value)
      loaded()
      return
    }
    
    loadJson(raw)
  }

  function loadJson(json: string) {
    data.value = JSON.parse(json, reviver)

    if(!data.value) {
      return
    }

    if(data.value.version < config.value.version) {
      upgradeData()
    }

    loaded()
  }

  function loaded() {
    toggleStates.value = new Map<number, boolean>([...weaponTypes.value.keys()!].map((_, index) => [index, false]))
  }

  function toggleCategory(index: number) {
    const currentValue = toggleStates.value!.get(index)
    toggleStates.value!.set(index, !currentValue)
  }

  function resetToggleStates() {
    for(var kv of toggleStates.value!) {
      toggleStates.value!.set(kv[0], false)
    }
  }

  function upgradeData() {
    if(!data.value) {
      return
    }

    if(data.value.version >= config.value.version) {
      return
    }

    for(const game of config.value.games) {
      if(data.value.progress.has(game.name)) {
        for(const weaponType of game.weaponTypes) {
          if(data.value.progress.get(game.name)!.has(weaponType.type)) {
            for(const weapon of weaponType.weapons) {
              if(data.value.progress.get(game.name)!.get(weaponType.type)!.find(w => w.name == weapon)) {
                for(const gameMode of game.supportedModes) {
                  if(!data.value.progress.get(game.name)!.get(weaponType.type)?.find(w => w.name == weapon)!.progress.has(gameMode.name)) {
                    data.value.progress.get(game.name)!.get(weaponType.type)?.find(w => w.name == weapon)!.progress.set(gameMode.name, new Map<string, boolean>(gameMode.camos.map(c => [c.name, false])))
                  }
                }
              } else {
                data.value.progress.get(game.name)!.get(weaponType.type)!.push(new Weapon(weapon, game.supportedModes))
              }
            }
          } else {
            data.value.progress.get(game.name)!.set(
              weaponType.type,
              weaponType.weapons.map(w => new Weapon(w, game.supportedModes))
            )
          }
        }
      } else {
        data.value.progress.set(game.name, new Map<string, Weapon[]>(
          game.weaponTypes.map(wt => [
            wt.type,
            wt.weapons.map(w => new Weapon(w, game.supportedModes))
          ])
        ))
      }
    }

    data.value.version = config.value.version
  }

  function getCamoTotalCompletionCount(camo: string) {
    return {
      total: weapons.value.length,
      completed: weapons.value.filter(w => w.progress.get(selectedMode.value.name)!.get(camo)).length
    }
  }

  function getWeaponsByType(weaponType: string) {
    return weaponTypes.value.get(weaponType)!
  }

  function getCamoCompletionCount(weaponType: string, camo: string) {
    return {
      total: getWeaponsByType(weaponType).length,
      completed: getWeaponsByType(weaponType).filter(w => w.progress.get(selectedMode.value.name)!.get(camo)).length
    }
  }

  function getTotalMaxLevelCount() {
    return {
      total: weapons.value.length,
      completed: weapons.value.filter(w => w.maxLvl).length
    }
  }

  function getWeaponTypeMaxLevelCount(weaponType: string) {
    return {
      total: getWeaponsByType(weaponType).length,
      completed: getWeaponsByType(weaponType).filter(w => w.maxLvl).length
    }
  }

  function getWeapon(weaponType: string, weaponName: string) {
    return weaponTypes.value.get(weaponType)!.find(w => w.name == weaponName)!
  }

  function getWeaponCompleted(weaponType: string, weaponName: string) {
    return weaponCompleted(getWeapon(weaponType, weaponName))
  }

  function weaponCompleted(weapon: Weapon) {
    return weapon.maxLvl && [...weapon.progress.get(selectedMode.value.name)!.values()].every(b => b)
  }

  function toggleCamoCompletion(weaponType: string, weaponName: string, camoType: string) {
    const weapon = getWeapon(weaponType, weaponName)
    const progress = weapon.progress.get(selectedMode.value.name)
    const completed = progress!.get(camoType)!
    progress!.set(camoType, !completed)
  }

  function toggleMaxLevel(weaponType: string, weaponName: string) {
    const weapon = getWeapon(weaponType, weaponName)
    weapon.maxLvl = !weapon.maxLvl
  }

  function getCompletionColour(camoType: string) {
    return camos.value.find(c => c.name == camoType)!.colour
  }

  function getWeaponTypeCompletionCount(weaponType: string) {
    const weapons = weaponTypes.value.get(weaponType)!
    return {
      total: weapons.length,
      completed: weapons.map(w => getWeaponCompleted(weaponType, w.name)).filter(b => b).length
    }
  }

  function getTotalCompleted() {
    const weapons = [...weaponTypes.value.values()!].flatMap(w => w)
    return {
      total: weapons.length,
      completed: weapons.filter(w => weaponCompleted(w)).length
    }
  }

  function getDataAsJson() {
    return JSON.stringify(data.value, replacer)
  }

  function importJson(data: string) {
    loadJson(data)
  }

  // Watchers
  watch(selectedGameIndex, () => {
    selectedModeIndex.value = 0
  })

  watch(data, () => {
    localStorage.setItem(dataKey, JSON.stringify(data.value, replacer))
  }, { deep: true })

  watch(selectedGameIndex, resetToggleStates)
  watch(selectedModeIndex, resetToggleStates)

  return {
    // State
    config,
    selectedGameIndex,
    selectedModeIndex,
    data,
    toggleStates,

    // Getters
    selectedGame,
    selectedMode,
    weaponTypes,
    camos,

    // Actions
    loadData,
    getCamoTotalCompletionCount,
    getCamoCompletionCount,
    getTotalMaxLevelCount,
    getWeaponTypeMaxLevelCount,
    getWeaponCompleted,
    toggleCamoCompletion,
    toggleMaxLevel,
    getCompletionColour,
    getWeaponTypeCompletionCount,
    getTotalCompleted,
    toggleCategory,
    getDataAsJson,
    importJson
  }
})
