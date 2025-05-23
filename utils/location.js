'use client'

import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Alert } from 'react-native'

// Hằng số cho khóa lưu trữ
const STORAGE_KEYS = {
  USER_SETTINGS: 'userSettings',
}

/**
 * Lấy vị trí hiện tại của người dùng
 * @returns {Promise<Object|null>} Vị trí hiện tại hoặc null nếu có lỗi
 */
export const getCurrentLocation = async () => {
  try {
    console.log('Location: Đang lấy vị trí hiện tại...')

    // Kiểm tra quyền truy cập vị trí
    const { status } = await Location.requestForegroundPermissionsAsync()
    console.log('Location: Trạng thái quyền vị trí:', status)

    if (status !== 'granted') {
      console.error('Location: Quyền truy cập vị trí bị từ chối')
      return null
    }

    // Lấy vị trí hiện tại
    console.log('Location: Đang lấy vị trí với độ chính xác cao...')
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    })

    console.log('Location: Đã lấy được vị trí hiện tại:', {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    })

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    }
  } catch (error) {
    console.error('Location: Lỗi khi lấy vị trí hiện tại:', error)

    // Thử lại với độ chính xác thấp hơn
    try {
      console.log('Location: Thử lại với độ chính xác thấp hơn...')
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      console.log('Location: Đã lấy được vị trí với độ chính xác thấp:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      })

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }
    } catch (retryError) {
      console.error(
        'Location: Lỗi khi thử lại với độ chính xác thấp:',
        retryError
      )
      return null
    }
  }
}

/**
 * Lấy địa chỉ từ tọa độ
 * @param {number} latitude Vĩ độ
 * @param {number} longitude Kinh độ
 * @returns {Promise<string|null>} Địa chỉ hoặc null nếu có lỗi
 */
export const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    console.log('Location: Đang lấy địa chỉ từ tọa độ:', {
      latitude,
      longitude,
    })

    // Thêm tham số ngẫu nhiên để tránh cache
    const randomParam = Math.random().toString(36).substring(7)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&_=${randomParam}`

    console.log('Location: Gọi API Nominatim:', url)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 giây timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AccShift Weather App',
        'Accept-Language': 'vi,en;q=0.9',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    const data = await response.json()
    console.log('Location: Kết quả từ Nominatim:', data)

    if (data && data.display_name) {
      console.log('Location: Đã lấy được địa chỉ:', data.display_name)
      return data.display_name
    }

    console.log('Location: Không thể lấy địa chỉ từ API')

    // Thử phương pháp thứ hai với Expo Location
    try {
      console.log('Location: Thử phương pháp thứ hai với Expo Location')
      const reverseResult = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      })

      console.log('Location: Kết quả từ Expo Location:', reverseResult)

      if (reverseResult && reverseResult.length > 0) {
        const { name, street, district, city, region, country } =
          reverseResult[0]
        const addressParts = []

        if (name) addressParts.push(name)
        if (street) addressParts.push(street)
        if (district) addressParts.push(district)
        if (city) addressParts.push(city)
        if (region && region !== city) addressParts.push(region)
        if (country) addressParts.push(country)

        const address = addressParts.join(', ')
        console.log('Location: Địa chỉ từ Expo Location:', address)
        return address
      }
    } catch (expError) {
      console.error('Location: Lỗi khi sử dụng Expo Location:', expError)
    }

    return null
  } catch (error) {
    console.error('Location: Lỗi khi lấy địa chỉ từ tọa độ:', error)

    // Thử phương pháp thứ hai với Expo Location
    try {
      console.log('Location: Thử phương pháp thứ hai với Expo Location sau lỗi')
      const reverseResult = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      })

      if (reverseResult && reverseResult.length > 0) {
        const { name, street, district, city, region, country } =
          reverseResult[0]
        const addressParts = []

        if (name) addressParts.push(name)
        if (street) addressParts.push(street)
        if (district) addressParts.push(district)
        if (city) addressParts.push(city)
        if (region && region !== city) addressParts.push(region)
        if (country) addressParts.push(country)

        const address = addressParts.join(', ')
        console.log('Location: Địa chỉ từ Expo Location (sau lỗi):', address)
        return address
      }
    } catch (expError) {
      console.error(
        'Location: Lỗi khi sử dụng Expo Location (sau lỗi):',
        expError
      )
    }

    return null
  }
}

/**
 * Lưu vị trí nhà
 * @param {Object} location Vị trí (latitude, longitude)
 * @param {string} address Địa chỉ
 * @returns {Promise<boolean>} Kết quả lưu
 */
export const saveHomeLocation = async (location, address) => {
  try {
    const locationData = {
      name: 'Home',
      address: address || '',
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date().toISOString(),
    }

    // Lưu vào AsyncStorage
    await AsyncStorage.setItem('homeLocation', JSON.stringify(locationData))

    // Cập nhật userSettings
    const userSettings = await getUserSettings()
    if (userSettings) {
      if (!userSettings.weatherLocation) {
        userSettings.weatherLocation = {}
      }
      userSettings.weatherLocation.home = {
        lat: location.latitude,
        lon: location.longitude,
        address: address || '',
      }

      // Nếu chưa có cài đặt useSingleLocation, khởi tạo là false
      if (userSettings.weatherLocation.useSingleLocation === undefined) {
        userSettings.weatherLocation.useSingleLocation = false
      }

      await saveUserSettings(userSettings)
    }

    return true
  } catch (error) {
    console.error('Error saving home location:', error)
    return false
  }
}

/**
 * Lưu vị trí công ty
 * @param {Object} location Vị trí (latitude, longitude)
 * @param {string} address Địa chỉ
 * @returns {Promise<boolean>} Kết quả lưu
 */
export const saveWorkLocation = async (location, address) => {
  try {
    const locationData = {
      name: 'Work',
      address: address || '',
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date().toISOString(),
    }

    // Lưu vào AsyncStorage
    await AsyncStorage.setItem('workLocation', JSON.stringify(locationData))

    // Cập nhật userSettings
    const userSettings = await getUserSettings()
    if (userSettings) {
      if (!userSettings.weatherLocation) {
        userSettings.weatherLocation = {}
      }
      userSettings.weatherLocation.work = {
        lat: location.latitude,
        lon: location.longitude,
        address: address || '',
      }

      // Nếu chưa có cài đặt useSingleLocation, khởi tạo là false
      if (userSettings.weatherLocation.useSingleLocation === undefined) {
        userSettings.weatherLocation.useSingleLocation = false
      }

      await saveUserSettings(userSettings)
    }

    return true
  } catch (error) {
    console.error('Error saving work location:', error)
    return false
  }
}

/**
 * Lấy vị trí nhà đã lưu
 * @returns {Promise<Object|null>} Vị trí nhà hoặc null nếu chưa lưu
 */
export const getHomeLocation = async () => {
  try {
    const savedLocation = await AsyncStorage.getItem('homeLocation')
    if (savedLocation) {
      return JSON.parse(savedLocation)
    }
    return null
  } catch (error) {
    console.error('Error getting home location:', error)
    return null
  }
}

/**
 * Lấy vị trí công ty đã lưu
 * @returns {Promise<Object|null>} Vị trí công ty hoặc null nếu chưa lưu
 */
export const getWorkLocation = async () => {
  try {
    const savedLocation = await AsyncStorage.getItem('workLocation')
    if (savedLocation) {
      return JSON.parse(savedLocation)
    }
    return null
  } catch (error) {
    console.error('Error getting work location:', error)
    return null
  }
}

/**
 * Tính khoảng cách giữa hai vị trí (theo km)
 * @param {Object} location1 Vị trí 1 (latitude, longitude)
 * @param {Object} location2 Vị trí 2 (latitude, longitude)
 * @returns {number} Khoảng cách (km)
 */
export const calculateDistance = (location1, location2) => {
  if (!location1 || !location2) return 0

  const R = 6371 // Bán kính trái đất (km)
  const dLat = deg2rad(location2.latitude - location1.latitude)
  const dLon = deg2rad(location2.longitude - location1.longitude)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(location1.latitude)) *
      Math.cos(deg2rad(location2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c // Khoảng cách (km)

  return distance
}

/**
 * Chuyển đổi độ sang radian
 * @param {number} deg Độ
 * @returns {number} Radian
 */
const deg2rad = (deg) => {
  return deg * (Math.PI / 180)
}

/**
 * Hiển thị hộp thoại xác nhận vị trí
 * @param {string} title Tiêu đề
 * @param {string} address Địa chỉ
 * @param {Function} onConfirm Hàm xử lý khi xác nhận
 */
export const showLocationConfirmDialog = (title, address, onConfirm) => {
  Alert.alert(
    title,
    `Địa chỉ: ${address}\n\nBạn có muốn lưu vị trí này không?`,
    [
      {
        text: 'Không',
        style: 'cancel',
      },
      {
        text: 'Có',
        onPress: onConfirm,
      },
    ]
  )
}

/**
 * Lấy cài đặt người dùng
 * @returns {Promise<Object|null>} Cài đặt người dùng hoặc null nếu có lỗi
 */
export const getUserSettings = async () => {
  try {
    const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_SETTINGS)
    if (!settingsJson) return null

    return JSON.parse(settingsJson)
  } catch (error) {
    console.error('Lỗi khi lấy cài đặt người dùng:', error)
    return null
  }
}

/**
 * Lưu cài đặt người dùng
 * @param {Object} settings Cài đặt người dùng
 * @returns {Promise<boolean>} Kết quả lưu
 */
export const saveUserSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_SETTINGS,
      JSON.stringify(settings)
    )
    return true
  } catch (error) {
    console.error('Lỗi khi lưu cài đặt người dùng:', error)
    return false
  }
}

/**
 * Cập nhật cài đặt sử dụng vị trí chung
 * @param {boolean} useSingleLocation Sử dụng vị trí chung hay không
 * @returns {Promise<boolean>} Kết quả cập nhật
 */
export const updateUseSingleLocation = async (useSingleLocation) => {
  try {
    const userSettings = await getUserSettings()
    if (userSettings) {
      if (!userSettings.weatherLocation) {
        userSettings.weatherLocation = {}
      }
      userSettings.weatherLocation.useSingleLocation = useSingleLocation
      await saveUserSettings(userSettings)
      return true
    }
    return false
  } catch (error) {
    console.error('Lỗi khi cập nhật cài đặt sử dụng vị trí chung:', error)
    return false
  }
}

/**
 * Hiển thị hộp thoại xác nhận sử dụng vị trí chung
 * @param {string} message Thông báo
 * @param {Function} onConfirm Hàm xử lý khi xác nhận
 * @param {Function} onCancel Hàm xử lý khi hủy
 */
export const showUseSingleLocationDialog = (message, onConfirm, onCancel) => {
  Alert.alert('Xác nhận vị trí thời tiết', message, [
    {
      text: 'Dùng riêng',
      onPress: onCancel || (() => {}),
      style: 'cancel',
    },
    {
      text: 'Dùng chung',
      onPress: onConfirm,
    },
  ])
}

/**
 * Kiểm tra thời gian giữa hai sự kiện
 * @param {number} timestamp1 Thời gian sự kiện 1
 * @param {number} timestamp2 Thời gian sự kiện 2
 * @returns {number} Khoảng thời gian (giây)
 */
export const getTimeBetweenEvents = (timestamp1, timestamp2) => {
  return Math.abs(timestamp2 - timestamp1) / 1000
}

export default {
  getCurrentLocation,
  getAddressFromCoordinates,
  saveHomeLocation,
  saveWorkLocation,
  getHomeLocation,
  getWorkLocation,
  calculateDistance,
  showLocationConfirmDialog,
  getUserSettings,
  saveUserSettings,
  updateUseSingleLocation,
  showUseSingleLocationDialog,
  getTimeBetweenEvents,
}
