## [1.2.0] 15.06.2023
- adapt to api changes done from bestways
  - using the new api
  - big thanks to https://github.com/schoendort/lazy_spa where I could see how requests are done
- currently it has not the best state of development, but it works at least, I will work on the plugin as soon as possible to make it reliable

## [1.1.1] 19.10.2022
- fix spamming logs with undefined characteristics 
  - when HotTub is not connected and api delivers nothing

## [1.1.0] 01.07.2022
- update all characteristics so home app shows changes immediately

## [1.0.9] 30.06.2022
- fix wrong usage

## [1.0.8] 30.06.2022
- disable heating when turning of filter (to avoid damage)
- fix typo in filter

## [1.0.7] 30.06.2022
- update state after set

## [1.0.6] 29.06.2022
- fix caching of state

## [1.0.5] 29.06.2022
- fix characteristics of thermostat once again

## [1.0.4] 29.06.2022
- have own toggle to power on
- fix characteristics of thermostat

## [1.0.3] 29.06.2022
- change to thermostat instead of heater/cooler
  - since whirlpool can't cool obviously

## [1.0.2] 28.06.2022
- first working version
- small cleanups

## [1.0.1] 28.06.2022

- adjustments to models and toggles
- individual toggle for waves and filter
- filter will always be activated when heating to avoid damage to the whirlpool

## [1.0.0] 28.06.2022
- use homebridge plugin template
- integrate lay-z api to access whirlpool