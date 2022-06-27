import {Service, PlatformAccessory, CharacteristicValue} from 'homebridge'

import {LayZSpaWhirlpool} from './platform'
import fetch from 'node-fetch'

export class HotTubAccessory {
    private service: Service

    private currentState = {
        power: false,
        currentTemp: 25,
        targetTemp: 30,
        heatingOn: false,
        filterOn: false,
        wavesOn: false,
        lastFetch: new Date(0)
    }

    constructor (
    private readonly platform: LayZSpaWhirlpool,
    private readonly accessory: PlatformAccessory,
    ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Bestway')
        .setCharacteristic(this.platform.Characteristic.Model, 'Lay-Z')
        .setCharacteristic(this.platform.Characteristic.SerialNumber, 'P05335')

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler)
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Heating')

    this.service
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(this.getOnState.bind(this))
        .onSet(this.setOnState.bind(this))

    this.service
        .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
        .onGet(this.getCurrentHeaterState.bind(this))
        .onSet(this.setCurrentHeaterState.bind(this))
        .setProps({
            maxValue: this.platform.Characteristic.CurrentHeaterCoolerState.HEATING,
            validValues: [
                this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE,
                this.platform.Characteristic.CurrentHeaterCoolerState.HEATING,
            ],
        })

    this.service
        .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
        .onGet(this.getHeatingTargetTemp.bind(this))
        .onSet(this.setHeatingTargetTemp.bind(this))
        .setProps({
            minValue: 20,
            maxValue: 40,
            minStep: 1
        })

    this.service
        .getCharacteristic(this.platform.Characteristic.Active)
        .onGet(this.getWaveOnState.bind(this))
        .onSet(this.setWaveOnState.bind(this))

    this.service
        .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
        .setProps({
            maxValue: this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS,
            validValues: [
                this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS
            ]
        })
        .setValue(this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS)

    this.service
        .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getCurrentTemperature.bind(this))

    setInterval(async () => {
        await this.getCurrentStatus()
    }, 10000)
    }

    async getCurrentStatus () {
        if (((new Date().getTime() - this.currentState.lastFetch.getTime()) / 1000) < (2 * 60 * 1000)) {
            this.platform.log.debug('Last fetch was just a few minutes ago, using last state')
            return
        }
        try {
            const response = await fetch(this.platform.serverUrl + `gizwits/status?api_token=${this.platform.apiToken}&did=${this.platform.deviceId}`,
                {
                    method: 'POST'
                })
            if (!response.ok) {
                this.platform.log.error(`Could not retrieve device status. Status ${response.status}`)
            }
            const result = await response.json()
            this.currentState.power = result.data.power as boolean
            this.currentState.currentTemp = result.data.temp_now
            this.currentState.targetTemp = result.data.temp_set
            this.currentState.heatingOn = result.data.heat_power as boolean
            this.currentState.filterOn = result.data.filter_power as boolean
            this.currentState.wavesOn = result.data.wave_power as boolean
            this.currentState.lastFetch = new Date()
        } catch (e) {
            this.platform.log.error('Something went wrong while trying to get stauts of device', e)
        }
    }

    async setOnState (value: CharacteristicValue) {
        this.currentState.power = value as boolean
        const targetState = this.currentState.power ? 'turn_on' : 'turn_off'
        await fetch(this.platform.serverUrl + `gizwits/${targetState}?api_token=${this.platform.apiToken}&did=${this.platform.deviceId}`, {
            method: 'POST'
        })
        this.platform.log.debug('Set Characteristic On ->', value)
    }

    async getOnState (): Promise<CharacteristicValue> {
        await this.getCurrentStatus()
        return this.currentState.power
    }

    async getCurrentTemperature (): Promise<CharacteristicValue> {
        await this.getCurrentStatus()
        return this.currentState.currentTemp
    }

    async setHeatingTargetTemp (value: CharacteristicValue) {
        this.currentState.targetTemp = value as number
        await fetch(this.platform.serverUrl + `gizwits/temp_set?api_token=${this.platform.apiToken}&did=${this.platform.deviceId}&temperature=${this.currentState.targetTemp}`, {
            method: 'POST'
        })
        this.platform.log.debug('Set Characteristic Temperature -> ', value)
    }

    async getCurrentHeaterState (): Promise<CharacteristicValue> {
        await this.getCurrentStatus()
        return this.currentState.heatingOn
            ? this.platform.Characteristic.CurrentHeaterCoolerState.HEATING
            : this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE
    }

    async setCurrentHeaterState (value: CharacteristicValue) {
        this.currentState.filterOn = value as boolean
        this.currentState.heatingOn = value as boolean
        const targetFilterState = this.currentState.heatingOn ? 'turn_filter_on' : 'turn_filter_off'
        const targetHeatingState = this.currentState.heatingOn ? 'turn_heat_on' : 'turn_heat_off'

        const response = await fetch(this.platform.serverUrl + `gizwits/${targetFilterState}?api_token=${this.platform.apiToken}&did=${this.platform.deviceId}`, {
            method: 'POST'
        })
        if (!response.ok) {
            this.platform.log.error('Could not set filter state, to avoid damage to the whirlpool heating will not be turned on.')
            return
        }
        await fetch(this.platform.serverUrl + `gizwits/${targetHeatingState}?api_token=${this.platform.apiToken}&did=${this.platform.deviceId}`, {
            method: 'POST'
        })
        this.platform.log.debug('Set Characteristic Filter and Heating ->', value)
    }

    async getHeatingTargetTemp (): Promise<CharacteristicValue> {
        await this.getCurrentStatus()
        return this.currentState.targetTemp
    }

    async getWaveOnState (): Promise<CharacteristicValue> {
        await this.getCurrentStatus()
        return this.currentState.wavesOn
    }

    async setWaveOnState (value: CharacteristicValue) {
        this.currentState.wavesOn = value as boolean
        const targetState = this.currentState.wavesOn ? 'turn_wave_on' : 'turn_wave_off'
        await fetch(this.platform.serverUrl + `gizwits/temp_set?${targetState}=${this.platform.apiToken}&did=${this.platform.deviceId}&temperature=${this.currentState.targetTemp}`, {
            method: 'POST'
        })
        this.platform.log.debug('Set Characteristic Waves -> ', value)
    }
}
