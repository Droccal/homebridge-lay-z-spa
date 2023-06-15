import {
    API,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic
} from 'homebridge'
import fetch from 'node-fetch'
import {PLATFORM_NAME, PLUGIN_NAME} from './settings'
import {HotTubAccessory} from './HotTubAccessory'

export class LayZSpaWhirlpool implements DynamicPlatformPlugin {
    public readonly baseUrl: string = 'https://euapi.gizwits.com/app/'
    public readonly Service: typeof Service = this.api.hap.Service
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic

    // this is used to track restored cached accessories
    public readonly accessories: PlatformAccessory[] = []

    public apiToken: string = ''

    constructor (
public readonly log: Logger,
public readonly config: PlatformConfig,
public readonly api: API,
    ) {
        this.log.debug('Finished initializing platform:', this.config.name)
        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback')

            this.retrieveApiKey(config.username, config.password).then(success => {
                if (success) {
                    this.discoverDevices().then(() =>
                        this.log.info('Finished initializing devices')
                    )
                }
            })
        })
    }

    configureAccessory (accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName)
        this.accessories.push(accessory)
    }

    async retrieveApiKey (username: string, password: string): Promise<boolean> {
        try {
            const response = await fetch(this.baseUrl + 'login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'X-Gizwits-Application-Id': '98754e684ec045528b073876c34c7348'},
                body: JSON.stringify({
                    username,
                    password,
                    lang: 'en'
                })
            })
            if (!response.ok) {
                this.log.error(`Could not retrieve api key. Status ${response.status}`)
                return false
            }

            const result = await response.json()
            this.apiToken = result.token
            this.log.info('Successfully retrieved api token')

            return true
        } catch (e) {
            this.log.error('Something went wrong while trying to retrieve api key', e)
            return false
        }
    }

    async discoverDevices () {
        const response = await fetch(this.baseUrl + 'bindings?limit=20&skip=0', {
            method: 'GET',
            headers: {'Content-Type': 'application/json', 'X-Gizwits-Application-Id': '98754e684ec045528b073876c34c7348', 'X-Gizwits-User-token': this.apiToken},
        })

        if (!response.ok) {
            this.log.error(`Could not retrieve devices ${response.status}`)
            return
        }

        const result = await response.json()
        result.devices.forEach((d: any) => {
            const uuid = this.api.hap.uuid.generate(d.did)
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

            if (existingAccessory) {
                this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName)

                // eslint-disable-next-line no-new
                new HotTubAccessory(this, existingAccessory, d.did)
            } else {
                this.log.info('Adding new accessory:', this.config.name)
                // eslint-disable-next-line new-cap
                const accessory = new this.api.platformAccessory(this.config.name!, uuid)
                // eslint-disable-next-line no-new
                new HotTubAccessory(this, accessory, d.did)

                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
            }
        })
    }
}
