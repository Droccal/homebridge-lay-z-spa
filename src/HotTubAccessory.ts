import {Service, PlatformAccessory, CharacteristicValue} from 'homebridge'

import {LayZSpaWhirlpool} from './platform'
import fetch, {Headers} from 'node-fetch'

export interface HotTubState {
    power: number,
    currentTemp: number,
    targetTemp: number,
    heatingOn: number,
    filterOn: number,
    wavesOn: number,
    lastFetch: Date | undefined
}

export class HotTubAccessory {
    private readonly deviceId: String

    private heatingService: Service
    private powerService: Service
    private waveService: Service
    private filterService: Service

    private currentState: HotTubState = {
        power: 0,
        currentTemp: 25,
        targetTemp: 30,
        heatingOn: 0,
        filterOn: 0,
        wavesOn: 0,
        lastFetch: undefined
    }

    constructor (
    private readonly platform: LayZSpaWhirlpool,
    private readonly accessory: PlatformAccessory,
    deviceId: String
    ) {
        this.platform.log.info(`Initializing Lay-Z accessory ${deviceId}`)
        this.deviceId = deviceId
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Bestway')
        .setCharacteristic(this.platform.Characteristic.Model, 'Lay-Z')
        .setCharacteristic(this.platform.Characteristic.SerialNumber, 'P05335')

    this.heatingService = this.accessory.getService(this.platform.Service.Thermostat) || this.accessory.addService(this.platform.Service.Thermostat)
    this.heatingService.setCharacteristic(this.platform.Characteristic.Name, 'Heating')

    this.waveService = this.accessory.getService('Wave Toggle') || this.accessory.addService(this.platform.Service.Outlet, 'Wave Toggle', 'cl4y2izfm00000e66uhbpjepl')
    this.waveService.setCharacteristic(this.platform.Characteristic.Name, 'Waves')

    this.powerService = this.accessory.getService('On/Off Toggle') || this.accessory.addService(this.platform.Service.Outlet, 'On/Off Toggle', 'cl4zd53hd00020e66521htk8j')
    this.powerService.setCharacteristic(this.platform.Characteristic.Name, 'On/Off')

    this.filterService = this.accessory.getService('Filter Toggle') || this.accessory.addService(this.platform.Service.Outlet, 'Filter Toggle', 'cl4y2jbxf00010e66yqzftf3z')
    this.filterService.setCharacteristic(this.platform.Characteristic.Name, 'Filter')

    this.powerService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getOnState.bind(this))
        .onSet(this.setOnState.bind(this))

    this.heatingService
        .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
        .onGet(this.getTargetHeaterState.bind(this))
        .onSet(this.setTargetHeaterState.bind(this))
        .setProps({
            maxValue: this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
            validValues: [
                this.platform.Characteristic.TargetHeatingCoolingState.OFF,
                this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
            ],
        })

    this.heatingService
        .getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
        .onGet(this.getCurrentHeaterState.bind(this))
        .setProps({
            maxValue: this.platform.Characteristic.CurrentHeatingCoolingState.HEAT,
            validValues: [
                this.platform.Characteristic.CurrentHeatingCoolingState.OFF,
                this.platform.Characteristic.CurrentHeatingCoolingState.HEAT,
            ],
        })

    this.heatingService
        .getCharacteristic(this.platform.Characteristic.TargetTemperature)
        .onGet(this.getHeatingTargetTemp.bind(this))
        .onSet(this.setHeatingTargetTemp.bind(this))
        .setProps({
            minValue: 20,
            maxValue: 40,
            minStep: 1
        })

    this.heatingService
        .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
        .setProps({
            maxValue: this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS,
            validValues: [
                this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS
            ]
        })
        .setValue(this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS)

    this.heatingService
        .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getCurrentTemperature.bind(this))

    this.waveService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getWaveOnState.bind(this))
        .onSet(this.setWaveOnState.bind(this))

    this.filterService
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getFilterOnState.bind(this))
        .onSet(this.setFilterOnState.bind(this))

    setInterval(async () => {
        await this.getCurrentStatus()
    }, 10000)
    }

    getHeader (): Headers {
        const h = new Headers()
        h.set('Content-Type', 'application/json')
        h.set('X-Gizwits-Application-Id', '98754e684ec045528b073876c34c7348')
        h.set('X-Gizwits-User-token', this.platform.apiToken)
        return h
    }

    async getCurrentStatus (force: boolean = false): Promise<HotTubState> {
        if (!force && this.currentState.lastFetch && (new Date().getTime() - this.currentState.lastFetch.getTime()) < (60 * 1000)) {
            this.platform.log.debug('Last fetch was under a minute ago, using last state')
            return this.currentState
        }
        try {
            const response = await fetch(this.platform.baseUrl + `devdata/${this.deviceId}/latest`,
                {
                    method: 'GET',
                    headers: this.getHeader()
                })
            if (!response.ok) {
                this.platform.log.error(`Could not retrieve device status. Status ${response.status}`)
                return this.currentState
            }
            const result = await response.json()
            if (result.attr.power === undefined) {
                this.platform.log.debug('Hottub seems to be not connected, therefore api returned nothing - setting default values')
                this.currentState.power = 0
                this.currentState.currentTemp = 25
                this.currentState.targetTemp = 25
                this.currentState.heatingOn = 0
                this.currentState.filterOn = 0
                this.currentState.wavesOn = 0
                this.currentState.lastFetch = new Date()
            } else {
                this.currentState.power = result.attr.power
                this.currentState.currentTemp = result.attr.temp_now
                this.currentState.targetTemp = result.attr.temp_set
                this.currentState.heatingOn = result.attr.heat_power
                this.currentState.filterOn = result.attr.filter_power
                this.currentState.wavesOn = result.attr.wave_power
                this.currentState.lastFetch = new Date()
            }

            this.powerService.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentState.power)
            this.filterService.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentState.filterOn)
            this.waveService.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentState.wavesOn)
            this.heatingService.getCharacteristic(this.platform.Characteristic.TargetTemperature).updateValue(this.currentState.targetTemp)
            this.heatingService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).updateValue(this.currentState.currentTemp)
            this.heatingService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState).updateValue(
                this.currentState.heatingOn
                    ? this.platform.Characteristic.CurrentHeatingCoolingState.HEAT
                    : this.platform.Characteristic.CurrentHeatingCoolingState.OFF)
            this.heatingService.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState).updateValue(
                this.currentState.heatingOn
                    ? this.platform.Characteristic.TargetHeatingCoolingState.HEAT
                    : this.platform.Characteristic.TargetHeatingCoolingState.OFF)

            return this.currentState
        } catch (e) {
            this.platform.log.error('Something went wrong while trying to get stauts of device', e)
            return this.currentState
        }
    }

    async setOnState (value: CharacteristicValue) {
        this.platform.log.debug('Set Characteristic On ->', value)
        this.currentState.power = value ? 1 : 0

        let body: any
        if (this.currentState.power === 1) {
            body = JSON.stringify({
                attrs: {
                    power: 1
                }
            })
        } else {
            body = JSON.stringify({
                attrs: {
                    power: 0,
                    filter_power: 0,
                    waves_power: 0,
                    heat_power: 0
                }
            })
        }
        await fetch(this.platform.baseUrl + `control/${this.deviceId}`, {
            method: 'POST',
            headers: this.getHeader(),
            body
        })
        await this.getCurrentStatus(true)
    }

    getOnState (): CharacteristicValue {
        return this.currentState.power
    }

    getCurrentTemperature (): CharacteristicValue {
        return this.currentState.currentTemp
    }

    async setHeatingTargetTemp (value: CharacteristicValue) {
        this.platform.log.debug('Set Characteristic Temperature -> ', value)
        this.currentState.targetTemp = value as number
        await fetch(this.platform.baseUrl + `control/${this.deviceId}`, {
            method: 'POST',
            headers: this.getHeader(),
            body: JSON.stringify({
                attrs: {
                    temp_set: this.currentState.targetTemp
                }
            })
        })
        await this.getCurrentStatus(true)
    }

    getCurrentHeaterState (): CharacteristicValue {
        return this.currentState.heatingOn
            ? this.platform.Characteristic.CurrentHeatingCoolingState.HEAT
            : this.platform.Characteristic.CurrentHeatingCoolingState.OFF
    }

    getTargetHeaterState (): CharacteristicValue {
        return this.currentState.heatingOn
            ? this.platform.Characteristic.TargetHeaterCoolerState.HEAT
            : this.platform.Characteristic.TargetHeaterCoolerState.AUTO
    }

    async setTargetHeaterState (value: CharacteristicValue) {
        this.platform.log.debug('Set Characteristic Filter and Heating ->', value)
        this.currentState.filterOn = value ? 1 : 0
        this.currentState.heatingOn = value ? 1 : 0

        const response = await fetch(this.platform.baseUrl + `control/${this.deviceId}`, {
            method: 'POST',
            headers: this.getHeader(),
            body: JSON.stringify({
                attrs: {
                    heat_power: this.currentState.heatingOn,
                    filter_power: this.currentState.heatingOn,
                }
            })
        })
        if (!response.ok) {
            this.platform.log.error('Could not set filter state, to avoid damage to the whirlpool heating will not be turned on.')
            await fetch(this.platform.baseUrl + `control/${this.deviceId}`, {
                method: 'POST',
                headers: this.getHeader(),
                body: JSON.stringify({
                    attrs: {
                        heat_power: 0,
                        filter_power: 0,
                    }
                })
            })
        }
        await this.getCurrentStatus(true)
    }

    getHeatingTargetTemp (): CharacteristicValue {
        return this.currentState.targetTemp
    }

    getWaveOnState (): CharacteristicValue {
        return this.currentState.wavesOn
    }

    async setWaveOnState (value: CharacteristicValue) {
        this.platform.log.debug('Set Characteristic Waves -> ', value)
        this.currentState.wavesOn = value ? 1 : 0
        await fetch(this.platform.baseUrl + `control/${this.deviceId}`, {
            method: 'POST',
            headers: this.getHeader(),
            body: JSON.stringify({
                attrs: {
                    wave_power: this.currentState.wavesOn
                }
            })
        })
        await this.getCurrentStatus(true)
    }

    getFilterOnState (): CharacteristicValue {
        return this.currentState.filterOn
    }

    async setFilterOnState (value: CharacteristicValue) {
        this.platform.log.debug('Set Characteristic Filter -> ', value)
        this.currentState.filterOn = value ? 1 : 0

        if (!this.currentState.filterOn && this.currentState.heatingOn) {
            this.currentState.heatingOn = value ? 1 : 0
            const response = await fetch(this.platform.baseUrl + `control/${this.deviceId}`, {
                method: 'POST',
                headers: this.getHeader(),
                body: JSON.stringify({
                    attrs: {
                        filter_power: this.currentState.heatingOn
                    }
                })
            })
            if (!response.ok) {
                this.platform.log.error('Could not set heating state, to avoid damage to the whirlpool filter will not be turned off.')
                return
            }
        }
        await fetch(this.platform.baseUrl + `control/${this.deviceId}`, {
            method: 'POST',
            headers: this.getHeader(),
            body: JSON.stringify({
                attrs: {
                    filter_power: this.currentState.filterOn
                }
            })
        })
        await this.getCurrentStatus(true)
    }
}
