import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Location from "expo-location";
import * as Network from "expo-network";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  Keyboard,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import UpdateModal from "../components/UpdateModal";
import { styles } from "../styles/weatherStyle";
import { fetchLatestVersion, isUpdateNeeded } from "../utils/CheckUpdate";
const API_KEY = "d70c50f8af041fbc683cce05ef1d1cab";
const { width, height } = Dimensions.get("window");
const isIOS = Platform.OS === "ios";
const currentVersion = "2.0.0";

// تحسين تحميل الصور
const weatherImages = {
  "day-clear": require("../assets/images/light-summer.jpg"),
  "day-rain": require("../assets/images/light-rain.jpg"),
  "day-cloudy": require("../assets/images/light-cloudy.jpg"),
  "day-snow": require("../assets/images/light-snow.jpg"),
  "day-windy": require("../assets/images/light-cloudy.jpg"),
  "day-default": require("../assets/images/default.jpg"),
  "night-clear": require("../assets/images/night.jpg"),
  "night-rain": require("../assets/images/night-rain.jpg"),
  "night-cloudy": require("../assets/images/night-cloudy.jpg"),
  "night-snow": require("../assets/images/night-snow.jpg"),
  "night-windy": require("../assets/images/night-cloudy.jpg"),
  "night-default": require("../assets/images/night.jpg"),
  default: require("../assets/images/default.jpg"),
};

// ثوابت التخزين
const CACHE_DURATION = 30 * 60 * 1000; // 30 دقيقة
const MAX_SEARCH_HISTORY = 10;

export default function WeatherApp() {
  // States
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [hourlyForecast, setHourlyForecast] = useState([]);
  const [detailedForecast, setDetailedForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [hasInternet, setHasInternet] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [showHourlyModal, setShowHourlyModal] = useState(false);
  const [selectedDayHourly, setSelectedDayHourly] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  // Refs
  const spinValue = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const forecastScrollRef = useRef(null);
  const hourlyScrollRef = useRef(null);
  const searchInputRef = useRef(null);
  const lastWeatherRequest = useRef(null);
  const debounceTimer = useRef(null);
  const isMounted = useRef(true);

  // تحميل البيانات المحفوظة عند البدء
  useEffect(() => {
    isMounted.current = true;

    const initializeApp = async () => {
      await loadSavedData();
      await checkInternetConnection();
    };

    initializeApp();

    // مستمعات الكيبورد
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => setKeyboardVisible(false)
    );

    return () => {
      isMounted.current = false;
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // جلب الموقع عند اكتمال تحميل البيانات
  useEffect(() => {
    if (
      !loading &&
      hasInternet &&
      !weather &&
      !showIntro &&
      isMounted.current
    ) {
      getLocation();
    }
  }, [loading, hasInternet, weather, showIntro]);

  // تأثير التحميل للشريط الأفقي
  useEffect(() => {
    if (loading && isMounted.current) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    } else if (isMounted.current) {
      progressAnim.setValue(0);
    }
  }, [loading]);

  // التحقق من الاصدار التحديث
  useEffect(() => {
    const check = async () => {
      const latest = await fetchLatestVersion();
      if (latest && isUpdateNeeded(latest.latestVersion, currentVersion)) {
        setUpdateInfo(latest);
        setShowModal(true);
      }
    };
    check();
  }, []);
  // ++++++++++++++
  // تحميل البيانات المحفوظة
  const loadSavedData = useCallback(async () => {
    if (!isMounted.current) return;

    try {
      const [settings, history, weatherCache] = await Promise.all([
        AsyncStorage.getItem("appSettings"),
        AsyncStorage.getItem("searchHistory"),
        AsyncStorage.getItem("weatherCache"),
      ]);

      if (settings && isMounted.current) {
        const parsedSettings = JSON.parse(settings);
        setDarkMode(parsedSettings.darkMode || false);
      }

      if (history && isMounted.current) {
        setSearchHistory(JSON.parse(history));
      }

      if (weatherCache && isMounted.current) {
        const { data, timestamp } = JSON.parse(weatherCache);
        const cacheAge = Date.now() - timestamp;

        if (cacheAge < CACHE_DURATION) {
          setWeather(data.weather);
          setForecast(data.forecast);
          setHourlyForecast(data.hourlyForecast);
          setDetailedForecast(data.detailedForecast);
          setLastUpdate(new Date(timestamp));
          setLoading(false);
          setShowIntro(false);
          setIsInitialLoad(false);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.log("خطأ في تحميل البيانات المحفوظة:", error);
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // حفظ الإعدادات
  const saveSettings = useCallback(async () => {
    try {
      const settings = { darkMode };
      await AsyncStorage.setItem("appSettings", JSON.stringify(settings));
    } catch (error) {
      console.log("خطأ في حفظ الإعدادات:", error);
    }
  }, [darkMode]);

  // حفظ بيانات الطقس
  const saveWeatherCache = useCallback(async (data, cityName) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        city: cityName,
      };
      await AsyncStorage.setItem("weatherCache", JSON.stringify(cacheData));
    } catch (error) {
      console.log("خطأ في حفظ ذاكرة التخزين المؤقت:", error);
    }
  }, []);

  // حفظ سجل البحث
  const saveSearchHistory = useCallback(async (history) => {
    try {
      await AsyncStorage.setItem("searchHistory", JSON.stringify(history));
    } catch (error) {
      console.log("خطأ في حفظ سجل البحث:", error);
    }
  }, []);

  // التحقق من اتصال الإنترنت
  const checkInternetConnection = useCallback(async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const isConnected =
        networkState.isConnected && networkState.isInternetReachable;
      if (isMounted.current) {
        setHasInternet(isConnected);
      }
      return isConnected;
    } catch (error) {
      console.log("خطأ في التحقق من الاتصال:", error);
      if (isMounted.current) {
        setHasInternet(false);
      }
      return false;
    }
  }, []);

  // تحسين التأثيرات عند تحميل البيانات
  useEffect(() => {
    if (!loading && weather && isMounted.current) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, weather, fadeAnim, slideAnim]);

  // تأثير دوران أيقونة التحميل
  useEffect(() => {
    if (loading && isMounted.current) {
      const animation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    }
  }, [loading, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // تحديد صورة الخلفية
  const getBackgroundImage = useCallback(() => {
    if (!weather) {
      return weatherImages.default;
    }

    const desc = weather.weather[0].description.toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    const { sunrise, sunset } = weather.sys || {};
    const isNight = sunrise && sunset ? now < sunrise || now > sunset : false;
    const timePrefix = isNight ? "night" : "day";

    // تحسين منطق تحديد الصور
    const weatherConditions = [
      { keywords: ["مطر", "رذاذ", "عاصفة رعدية"], image: `${timePrefix}-rain` },
      { keywords: ["غيوم", "غائم", "ضباب"], image: `${timePrefix}-cloudy` },
      { keywords: ["ثلج", "صقيع"], image: `${timePrefix}-snow` },
      { keywords: ["عاصف", "ريح", "رياح"], image: `${timePrefix}-windy` },
    ];

    for (const condition of weatherConditions) {
      if (condition.keywords.some((keyword) => desc.includes(keyword))) {
        return weatherImages[condition.image] || weatherImages.default;
      }
    }

    return weatherImages[`${timePrefix}-clear`] || weatherImages.default;
  }, [weather]);

  // تحديد ألوان الثيم
  const getThemeColors = useCallback(() => {
    const baseColors = {
      accent: "#3B82F6",
      error: "#EF4444",
      warning: "#F59E0B",
      success: "#10B981",
    };

    if (!weather) {
      return {
        ...baseColors,
        text: "#FFFFFF",
        secondary: "rgba(255,255,255,0.8)",
        card: "rgba(0,0,0,0.4)",
        watermark: "rgba(255,255,255,0.6)",
        border: "rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.3)",
      };
    }

    const desc = weather.weather[0].description.toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    const { sunrise, sunset } = weather.sys || {};
    const isNight = sunrise && sunset ? now < sunrise || now > sunset : false;

    if (darkMode || isNight) {
      return {
        ...baseColors,
        text: "#FFFFFF",
        secondary: "rgba(255,255,255,0.8)",
        card: darkMode ? "rgba(28,28,30,0.85)" : "rgba(0,0,0,0.6)",
        watermark: "rgba(255,255,255,0.6)",
        border: "rgba(255,255,255,0.15)",
        accent: "#60A5FA",
        background: "rgba(0,0,0,0.3)",
      };
    }

    const isBrightWeather =
      !isNight &&
      !desc.includes("مطر") &&
      !desc.includes("غيوم") &&
      !desc.includes("غائم");

    if (isBrightWeather) {
      return {
        ...baseColors,
        text: "#0F172A",
        secondary: "rgba(15,23,42,0.8)",
        card: "rgba(255,255,255,0.9)",
        watermark: "rgba(15,23,42,0.6)",
        border: "rgba(0,0,0,0.1)",
        background: "rgba(255,255,255,0.3)",
      };
    }

    return {
      ...baseColors,
      text: "#FFFFFF",
      secondary: "rgba(255,255,255,0.8)",
      card: "rgba(0,0,0,0.5)",
      watermark: "rgba(255,255,255,0.6)",
      border: "rgba(255,255,255,0.15)",
      background: "rgba(0,0,0,0.3)",
    };
  }, [weather, darkMode]);

  // معالجة التوقعات الساعية
  const processHourlyForecast = useCallback((list) => {
    const now = new Date();
    const currentHour = now.getHours();

    return list
      .filter((item, index) => {
        if (index >= 8) return false;
        const itemTime = new Date(item.dt * 1000);
        const diffHours = (itemTime - now) / (1000 * 60 * 60);
        return diffHours >= 0;
      })
      .slice(0, 8)
      .map((item, index) => {
        const itemTime = new Date(item.dt * 1000);
        const hour = itemTime.getHours();
        const isCurrentHour = hour === currentHour;

        return {
          time: isCurrentHour
            ? "الآن"
            : itemTime.toLocaleTimeString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
              }),
          hour,
          temp: Math.round(item.main.temp),
          icon: item.weather[0].icon,
          description: item.weather[0].description,
          humidity: item.main.humidity,
          wind: Math.round(item.wind.speed * 3.6),
          feels_like: Math.round(item.main.feels_like),
          pressure: item.main.pressure,
          pop: Math.round(item.pop * 100),
          isCurrentHour,
        };
      });
  }, []);

  // معالجة التوقعات التفصيلية
  const processDetailedForecast = useCallback((list) => {
    const byDay = {};
    const today = new Date().toDateString();

    list.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().split("T")[0];

      if (!byDay[dayKey]) {
        const isToday = date.toDateString() === today;
        byDay[dayKey] = {
          dayName: isToday
            ? "اليوم"
            : date.toLocaleDateString("ar-EG", { weekday: "long" }),
          date: date.toLocaleDateString("ar-EG", {
            day: "numeric",
            month: "short",
          }),
          hourly: [],
          summary: {
            temp_max: item.main.temp_max,
            temp_min: item.main.temp_min,
            mainWeather: item.weather[0].main,
            description: item.weather[0].description,
            icon: item.weather[0].icon,
          },
        };
      }

      byDay[dayKey].hourly.push({
        time: date.toLocaleTimeString("ar-EG", { hour: "2-digit" }),
        hour: date.getHours(),
        temp: Math.round(item.main.temp),
        feels_like: Math.round(item.main.feels_like),
        humidity: item.main.humidity,
        wind: Math.round(item.wind.speed * 3.6),
        pressure: item.main.pressure,
        icon: item.weather[0].icon,
        description: item.weather[0].description,
        pop: Math.round(item.pop * 100),
      });

      // تحديث القيم القصوى والدنيا
      byDay[dayKey].summary.temp_max = Math.max(
        byDay[dayKey].summary.temp_max,
        item.main.temp_max
      );
      byDay[dayKey].summary.temp_min = Math.min(
        byDay[dayKey].summary.temp_min,
        item.main.temp_min
      );

      // تحديث الأيقونة بناءً على الحالة الأكثر شدة
      const weatherPriority = {
        Thunderstorm: 5,
        Rain: 4,
        Snow: 4,
        Drizzle: 3,
        Clouds: 2,
        Clear: 1,
        Mist: 2,
        Smoke: 2,
        Haze: 2,
        Dust: 2,
        Fog: 2,
        Sand: 2,
        Ash: 2,
        Squall: 3,
        Tornado: 5,
      };

      const currentPriority = weatherPriority[item.weather[0].main] || 0;
      const existingPriority =
        weatherPriority[byDay[dayKey].summary.mainWeather] || 0;

      if (currentPriority > existingPriority) {
        byDay[dayKey].summary.icon = item.weather[0].icon;
        byDay[dayKey].summary.mainWeather = item.weather[0].main;
        byDay[dayKey].summary.description = item.weather[0].description;
      }
    });

    // تحويل القيم وتقريبها
    return Object.keys(byDay)
      .sort()
      .slice(0, 5)
      .map((dayKey) => ({
        dateKey: dayKey,
        ...byDay[dayKey],
        summary: {
          ...byDay[dayKey].summary,
          temp_max: Math.round(byDay[dayKey].summary.temp_max),
          temp_min: Math.round(byDay[dayKey].summary.temp_min),
        },
      }));
  }, []);

  // جلب بيانات الطقس
  const fetchWeatherData = useCallback(
    async (cityName = null, lat = null, lon = null) => {
      if (!isMounted.current) return;

      const requestId = Date.now();
      lastWeatherRequest.current = requestId;

      if (!hasInternet) {
        Alert.alert(
          "⚠️ لا يوجد اتصال بالإنترنت",
          "يرجى التحقق من الاتصال والمحاولة مرة أخرى",
          [{ text: "حسناً" }]
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setLoading(true);
        setShowIntro(false);
        setShowSearchHistory(false);
        setLocationError(false);
        Keyboard.dismiss();

        let urlCurrent, urlForecast;
        const cacheKey = cityName || `${lat},${lon}`;

        const params = {
          appid: API_KEY,
          units: "metric",
          lang: "ar",
        };

        if (cityName) {
          urlCurrent = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
            cityName
          )}`;
          urlForecast = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
            cityName
          )}`;
        } else {
          urlCurrent = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}`;
          urlForecast = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}`;
        }

        // إضافة المعلمات
        const addParams = (url) => {
          const urlObj = new URL(url);
          Object.keys(params).forEach((key) => {
            urlObj.searchParams.append(key, params[key]);
          });
          return urlObj.toString();
        };

        const [currentRes, forecastRes] = await Promise.all([
          axios.get(addParams(urlCurrent), { timeout: 10000 }),
          axios.get(addParams(urlForecast), { timeout: 10000 }),
        ]);

        // التحقق من أحدث طلب
        if (lastWeatherRequest.current !== requestId || !isMounted.current)
          return;

        const weatherData = currentRes.data;
        const forecastData = forecastRes.data;

        // معالجة البيانات
        const hourlyData = processHourlyForecast(forecastData.list);
        const detailedData = processDetailedForecast(forecastData.list);

        // تحديث الحالة
        setWeather(weatherData);
        setCity(weatherData.name);
        setHourlyForecast(hourlyData);
        setDetailedForecast(detailedData);

        // إعداد التوقعات اليومية
        const dailyForecast = detailedData.map((day) => ({
          dt: new Date(day.dateKey).getTime() / 1000,
          main: {
            temp:
              day.hourly[Math.floor(day.hourly.length / 2)]?.temp ||
              day.summary.temp_max,
            temp_max: day.summary.temp_max,
            temp_min: day.summary.temp_min,
          },
          weather: [
            {
              icon: day.summary.icon,
              description: day.summary.description,
            },
          ],
          dayName: day.dayName,
        }));

        setForecast(dailyForecast);
        setLastUpdate(new Date());
        setIsInitialLoad(false);
        setImageLoading(false);

        // حفظ البيانات
        const cacheData = {
          weather: weatherData,
          forecast: dailyForecast,
          hourlyForecast: hourlyData,
          detailedForecast: detailedData,
        };

        await saveWeatherCache(cacheData, cacheKey);

        // تحديث سجل البحث
        if (cityName && cityName.trim()) {
          const cleanCityName = cityName.trim();
          const updatedHistory = [
            cleanCityName,
            ...searchHistory.filter(
              (item) => item.toLowerCase() !== cleanCityName.toLowerCase()
            ),
          ].slice(0, MAX_SEARCH_HISTORY);

          setSearchHistory(updatedHistory);
          await saveSearchHistory(updatedHistory);
        }
      } catch (err) {
        // التحقق من أحدث طلب
        if (lastWeatherRequest.current !== requestId || !isMounted.current)
          return;

        console.log("خطأ في جلب البيانات:", err?.response?.data || err.message);

        let errorMessage = "يرجى المحاولة مرة أخرى لاحقاً";

        if (err.code === "ECONNABORTED") {
          errorMessage = "تأخر الاستجابة، يرجى المحاولة مرة أخرى";
        } else if (err.response?.status === 404) {
          errorMessage = "المدينة غير موجودة، يرجى التحقق من الاسم";
        } else if (err.response?.status === 401) {
          errorMessage = "مفتاح API غير صالح";
        } else if (err.response?.status === 429) {
          errorMessage = "لقد تجاوزت عدد الطلبات المسموح به";
        } else if (err.message?.includes("Network Error")) {
          errorMessage = "خطأ في الشبكة، يرجى التحقق من الاتصال";
        }

        Alert.alert("⚠️ خطأ", errorMessage, [{ text: "حسناً" }]);

        // إذا فشل الطلب، عرض البيانات المخزنة
        try {
          const cached = await AsyncStorage.getItem("weatherCache");
          if (cached && isMounted.current) {
            const { data } = JSON.parse(cached);
            setWeather(data.weather);
            setForecast(data.forecast);
            setHourlyForecast(data.hourlyForecast);
            setDetailedForecast(data.detailedForecast);
          }
        } catch (cacheError) {
          console.log("خطأ في تحميل البيانات المخزنة:", cacheError);
        }
      } finally {
        if (lastWeatherRequest.current === requestId && isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      hasInternet,
      processHourlyForecast,
      processDetailedForecast,
      searchHistory,
      saveWeatherCache,
      saveSearchHistory,
    ]
  );

  // دالة البحث مع debounce
  const searchCity = useCallback(
    (cityName) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        if (cityName.trim() && isMounted.current) {
          fetchWeatherData(cityName.trim());
        }
      }, 500);
    },
    [fetchWeatherData]
  );

  const fetchByCity = useCallback(
    (cityName) => {
      if (cityName && cityName.trim()) {
        searchCity(cityName);
      }
    },
    [searchCity]
  );

  const fetchByCoords = useCallback(
    async (lat, lon) => {
      if (isMounted.current) {
        await fetchWeatherData(null, lat, lon);
      }
    },
    [fetchWeatherData]
  );

  // جلب الموقع الحالي
  const getLocation = useCallback(async () => {
    if (!isMounted.current) return;

    try {
      setLocationError(false);
      setLoading(true);

      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (newStatus !== "granted") {
          if (isMounted.current) {
            setLoading(false);
            setLocationError(true);
            Alert.alert(
              "⚠️ إذن الموقع مطلوب",
              "يرجى السماح بالوصول إلى الموقع لاستخدام هذه الميزة",
              [
                { text: "لاحقاً", style: "cancel" },
                {
                  text: "الإعدادات",
                  onPress: () => {
                    Location.requestForegroundPermissionsAsync();
                  },
                },
              ]
            );
          }
          return;
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });

      if (isMounted.current) {
        await fetchByCoords(
          location.coords.latitude,
          location.coords.longitude
        );
      }
    } catch (error) {
      console.log("خطأ في الموقع:", error);

      if (isMounted.current) {
        setLoading(false);
        setLocationError(true);

        if (error.code === "CANCELLED") {
          Alert.alert("⚠️ تم إلغاء طلب الموقع");
        } else if (error.code === "UNAVAILABLE") {
          Alert.alert("⚠️ الخدمة غير متوفرة", "تعذر الوصول إلى خدمات الموقع");
        } else {
          Alert.alert("⚠️ خطأ", "تعذر الحصول على الموقع الحالي");
        }
      }
    }
  }, [fetchByCoords]);

  const handleRefresh = useCallback(async () => {
    if (refreshing || !hasInternet || !isMounted.current) return;

    setRefreshing(true);
    setImageLoading(true);

    try {
      if (weather?.coord) {
        await fetchByCoords(weather.coord.lat, weather.coord.lon);
      } else if (city.trim()) {
        await fetchByCity(city.trim());
      } else {
        await getLocation();
      }
    } catch (error) {
      console.log("خطأ في التحديث:", error);
      if (isMounted.current) {
        setRefreshing(false);
        setImageLoading(false);
      }
    }
  }, [
    refreshing,
    hasInternet,
    weather,
    city,
    fetchByCoords,
    fetchByCity,
    getLocation,
  ]);

  const toggleDarkMode = useCallback(() => {
    if (isMounted.current) {
      setDarkMode((prev) => {
        const newMode = !prev;
        saveSettings();
        return newMode;
      });
    }
  }, [saveSettings]);

  const showDayDetails = useCallback(
    (dayIndex) => {
      if (isMounted.current && detailedForecast[dayIndex]) {
        setSelectedDayIndex(dayIndex);
        setSelectedDayHourly(detailedForecast[dayIndex].hourly);
        setShowHourlyModal(true);
      }
    },
    [detailedForecast]
  );

  const clearSearchHistory = useCallback(async () => {
    Alert.alert("مسح سجل البحث", "هل تريد مسح سجل البحث بالكامل؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "مسح",
        onPress: async () => {
          if (isMounted.current) {
            setSearchHistory([]);
            await AsyncStorage.removeItem("searchHistory");
          }
        },
        style: "destructive",
      },
    ]);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    if (hasInternet && city.trim() && isMounted.current) {
      Keyboard.dismiss();
      fetchByCity(city.trim());
    }
  }, [hasInternet, city, fetchByCity]);

  const formatTemperature = useCallback((temp) => {
    return `${Math.round(temp)}°`;
  }, []);

  // تنسيق الوقت
  const formatTime = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // تنسيق التاريخ
  const formatDate = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleDateString("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  const renderNoInternetScreen = () => {
    const colors = getThemeColors();

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.card }]}>
        <View style={styles.noInternetContainer}>
          <Animated.View style={{ opacity: fadeAnim }}>
            <Icon
              name="wifi"
              size={100}
              color={colors.text}
              style={[styles.noInternetIcon, { opacity: 0.7 }]}
            />
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={[styles.noInternetTitle, { color: colors.text }]}>
              📡 لا يوجد اتصال بالإنترنت
            </Text>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={[styles.noInternetText, { color: colors.secondary }]}>
              يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى
            </Text>
          </Animated.View>

          <View style={styles.noInternetButtons}>
            <Animated.View style={{ opacity: fadeAnim, width: "100%" }}>
              <TouchableOpacity
                style={[
                  styles.noInternetButton,
                  { backgroundColor: colors.accent },
                ]}
                onPress={() => {
                  checkInternetConnection().then((connected) => {
                    if (connected) {
                      getLocation();
                    } else {
                      Alert.alert("⚠️ لا يزال الاتصال غير متوفر");
                    }
                  });
                }}
                activeOpacity={0.8}
              >
                <Icon name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.noInternetButtonText}>إعادة المحاولة</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ opacity: fadeAnim, width: "100%" }}>
              <TouchableOpacity
                style={[
                  styles.noInternetButtonSecondary,
                  { borderColor: colors.text },
                ]}
                onPress={() => setShowIntro(true)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.noInternetButtonTextSecondary,
                    { color: colors.text },
                  ]}
                >
                  العودة للواجهة الرئيسية
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {weather && (
            <Animated.View style={{ opacity: fadeAnim }}>
              <TouchableOpacity
                style={[
                  styles.offlineDataButton,
                  { backgroundColor: colors.card },
                ]}
                onPress={() => setShowIntro(false)}
                activeOpacity={0.8}
              >
                <Icon name="history" size={16} color={colors.text} />
                <Text style={[styles.offlineDataText, { color: colors.text }]}>
                  عرض البيانات المخزنة مؤقتاً
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    );
  };

  const renderIntroScreen = () => {
    const colors = getThemeColors();

    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: colors.background }]}
        >
          <ScrollView
            style={styles.introScrollView}
            contentContainerStyle={styles.introScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.introContainer}>
              <Animated.View
                style={[
                  styles.introContent,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={styles.introIconContainer}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Icon
                      name="cloud"
                      size={100}
                      color={colors.text}
                      style={styles.introIcon}
                    />
                  </Animated.View>
                  <View style={styles.introIconGlow} />
                </View>

                <Animated.View style={{ opacity: fadeAnim }}>
                  <Text style={[styles.introTitle, { color: colors.text }]}>
                    🌤️ تطبيق الطقس الذكي
                  </Text>
                </Animated.View>

                <Animated.View style={{ opacity: fadeAnim }}>
                  <Text
                    style={[styles.introSubtitle, { color: colors.secondary }]}
                  >
                    استكشف حالة الطقس بدقة وأسلوب في أي مكان حول العالم
                  </Text>
                </Animated.View>

                {!hasInternet && (
                  <Animated.View
                    style={[
                      styles.offlineWarning,
                      {
                        backgroundColor: colors.warning + "20",
                        opacity: fadeAnim,
                      },
                    ]}
                  >
                    <Icon
                      name="exclamation-triangle"
                      size={20}
                      color={colors.warning}
                    />
                    <Text
                      style={[
                        styles.offlineWarningText,
                        { color: colors.text },
                      ]}
                    >
                      وضع عدم الاتصال
                    </Text>
                  </Animated.View>
                )}

                <Animated.View
                  style={[styles.introFeatures, { opacity: fadeAnim }]}
                >
                  {[
                    { icon: "map-marker", text: "موقع دقيق" },
                    { icon: "clock-o", text: "تحديث لحظي" },
                    { icon: "sun-o", text: "وضع ليلي" },
                  ].map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <Icon
                        name={feature.icon}
                        size={24}
                        color={colors.accent}
                      />
                      <Text
                        style={[styles.featureText, { color: colors.text }]}
                      >
                        {feature.text}
                      </Text>
                    </View>
                  ))}
                </Animated.View>

                <View style={styles.introButtons}>
                  <Animated.View style={{ opacity: fadeAnim, width: "100%" }}>
                    <TouchableOpacity
                      style={[
                        styles.introButtonPrimary,
                        { backgroundColor: colors.accent },
                      ]}
                      onPress={getLocation}
                      disabled={!hasInternet}
                      activeOpacity={0.8}
                    >
                      <Icon
                        name="location-arrow"
                        size={22}
                        color="#FFFFFF"
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.introButtonPrimaryText}>
                        {hasInternet ? "الموقع الحالي" : "الاتصال غير متوفر"}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>

                  <Animated.View
                    style={[styles.orContainer, { opacity: fadeAnim }]}
                  >
                    <View
                      style={[
                        styles.orLine,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <Text style={[styles.orText, { color: colors.secondary }]}>
                      أو
                    </Text>
                    <View
                      style={[
                        styles.orLine,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  </Animated.View>

                  <View style={styles.searchIntroSection}>
                    <Animated.View style={{ opacity: fadeAnim }}>
                      <Text
                        style={[styles.searchLabel, { color: colors.text }]}
                      >
                        ابحث عن مدينة
                      </Text>
                    </Animated.View>

                    <Animated.View
                      style={[
                        styles.searchIntroContainer,
                        { opacity: fadeAnim },
                      ]}
                    >
                      <TextInput
                        ref={searchInputRef}
                        style={[
                          styles.searchIntroInput,
                          {
                            backgroundColor: colors.card,
                            color: colors.text,
                            borderColor: colors.border,
                          },
                        ]}
                        placeholder="🔍 أدخل اسم المدينة..."
                        placeholderTextColor={colors.secondary}
                        value={city}
                        onChangeText={setCity}
                        onSubmitEditing={handleSearchSubmit}
                        editable={hasInternet}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={[
                          styles.searchIntroButton,
                          { backgroundColor: colors.accent },
                        ]}
                        onPress={handleSearchSubmit}
                        disabled={!hasInternet || !city.trim()}
                        activeOpacity={0.8}
                      >
                        <Icon name="search" size={22} color="#FFFFFF" />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>

                  {searchHistory.length > 0 && (
                    <Animated.View
                      style={[
                        styles.searchHistorySection,
                        { opacity: fadeAnim },
                      ]}
                    >
                      <View style={styles.searchHistoryHeader}>
                        <Text
                          style={[
                            styles.searchHistoryTitle,
                            { color: colors.text },
                          ]}
                        >
                          🔍 البحث السابق
                        </Text>
                        <TouchableOpacity onPress={clearSearchHistory}>
                          <Text
                            style={[
                              styles.clearHistoryText,
                              { color: colors.accent },
                            ]}
                          >
                            مسح الكل
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        {searchHistory.map((item, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.historyItem,
                              { backgroundColor: colors.card },
                            ]}
                            onPress={() => {
                              setCity(item);
                              fetchByCity(item);
                            }}
                            activeOpacity={0.7}
                          >
                            <Icon
                              name="history"
                              size={14}
                              color={colors.secondary}
                            />
                            <Text
                              style={[
                                styles.historyText,
                                { color: colors.text },
                              ]}
                            >
                              {item}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </Animated.View>
                  )}
                </View>

                <Animated.View style={{ opacity: fadeAnim }}>
                  <Text style={[styles.introHint, { color: colors.secondary }]}>
                    💡 يمكنك تغيير مظهر التطبيق باستخدام زر القمر/الشمس في
                    الزاوية العلوية
                  </Text>
                </Animated.View>
              </Animated.View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    );
  };

  const renderLoading = () => {
    const colors = getThemeColors();

    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[styles.loadingContent, { transform: [{ rotate: spin }] }]}
          >
            <Icon name="cloud" size={80} color={colors.text} />
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={[styles.loadingText, { color: colors.text }]}>
              {isInitialLoad
                ? "جاري تحميل بيانات الطقس..."
                : "جاري تحديث البيانات..."}
            </Text>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={[styles.loadingSubtext, { color: colors.secondary }]}>
              قد تستغرق العملية بضع ثوانٍ
            </Text>
          </Animated.View>

          <View style={styles.loadingProgress}>
            <Animated.View
              style={[
                styles.loadingProgressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                  backgroundColor: colors.accent,
                },
              ]}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  };

  const renderHourlyModal = () => {
    const colors = getThemeColors();

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showHourlyModal}
        onRequestClose={() => setShowHourlyModal(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <TouchableWithoutFeedback onPress={() => setShowHourlyModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalBackdrop} />
              <TouchableWithoutFeedback>
                <Animated.View
                  style={[
                    styles.modalContainer,
                    {
                      backgroundColor: colors.card,
                      transform: [{ translateY: slideAnim }],
                    },
                  ]}
                >
                  <View style={styles.modalHandle} />

                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>
                        {selectedDayHourly.length > 0 && (
                          <>
                            {detailedForecast[selectedDayIndex]?.dayName}
                            <Text style={{ color: colors.secondary }}>
                              {" - "}
                              {detailedForecast[selectedDayIndex]?.date}
                            </Text>
                          </>
                        )}
                      </Text>
                      <Text
                        style={[
                          styles.modalSubtitle,
                          { color: colors.secondary },
                        ]}
                      >
                        تفاصيل الطقس لكل ساعة
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.closeButton,
                        { backgroundColor: colors.card },
                      ]}
                      onPress={() => setShowHourlyModal(false)}
                      activeOpacity={0.7}
                    >
                      <Icon name="times" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={styles.modalScrollView}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.modalScrollContent}
                  >
                    {selectedDayHourly.map((hour, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.hourlyItem,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View style={styles.hourlyItemHeader}>
                          <View style={styles.hourlyTimeContainer}>
                            <Text
                              style={[
                                styles.hourlyTime,
                                { color: colors.text },
                              ]}
                            >
                              {hour.time}
                            </Text>
                            {hour.pop > 30 && (
                              <View
                                style={[
                                  styles.rainChanceBadge,
                                  { backgroundColor: colors.accent + "20" },
                                ]}
                              >
                                <Icon
                                  name="tint"
                                  size={12}
                                  color={colors.accent}
                                />
                                <Text
                                  style={[
                                    styles.rainChanceText,
                                    { color: colors.accent },
                                  ]}
                                >
                                  {hour.pop}%
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.hourlyTempMain}>
                            <Text
                              style={[
                                styles.hourlyTemp,
                                { color: colors.text },
                              ]}
                            >
                              {formatTemperature(hour.temp)}
                            </Text>
                            <Text
                              style={[
                                styles.hourlyFeelsLike,
                                { color: colors.secondary },
                              ]}
                            >
                              يشعر كـ {formatTemperature(hour.feels_like)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.hourlyDetails}>
                          {hour.icon && (
                            <Image
                              source={{
                                uri: `https://openweathermap.org/img/wn/${hour.icon}@2x.png`,
                              }}
                              style={styles.hourlyIcon}
                              resizeMode="contain"
                              onLoad={() => setImageLoading(false)}
                              onError={() => setImageLoading(false)}
                            />
                          )}
                          <Text
                            style={[
                              styles.hourlyDescription,
                              { color: colors.text },
                            ]}
                          >
                            {hour.description}
                          </Text>
                        </View>

                        <View style={styles.hourlyStats}>
                          <View style={styles.hourlyStat}>
                            <View
                              style={[
                                styles.statIconContainer,
                                { backgroundColor: colors.accent + "20" },
                              ]}
                            >
                              <Icon
                                name="tint"
                                size={16}
                                color={colors.accent}
                              />
                            </View>
                            <View>
                              <Text
                                style={[
                                  styles.hourlyStatValue,
                                  { color: colors.text },
                                ]}
                              >
                                {hour.humidity}%
                              </Text>
                              <Text
                                style={[
                                  styles.hourlyStatLabel,
                                  { color: colors.secondary },
                                ]}
                              >
                                رطوبة
                              </Text>
                            </View>
                          </View>
                          <View style={styles.hourlyStat}>
                            <View
                              style={[
                                styles.statIconContainer,
                                { backgroundColor: colors.accent + "20" },
                              ]}
                            >
                              <Icon
                                name="wind"
                                size={16}
                                color={colors.accent}
                              />
                            </View>
                            <View>
                              <Text
                                style={[
                                  styles.hourlyStatValue,
                                  { color: colors.text },
                                ]}
                              >
                                {hour.wind} كم/س
                              </Text>
                              <Text
                                style={[
                                  styles.hourlyStatLabel,
                                  { color: colors.secondary },
                                ]}
                              >
                                رياح
                              </Text>
                            </View>
                          </View>
                          <View style={styles.hourlyStat}>
                            <View
                              style={[
                                styles.statIconContainer,
                                { backgroundColor: colors.accent + "20" },
                              ]}
                            >
                              <Icon
                                name="tachometer"
                                size={16}
                                color={colors.accent}
                              />
                            </View>
                            <View>
                              <Text
                                style={[
                                  styles.hourlyStatValue,
                                  { color: colors.text },
                                ]}
                              >
                                {hour.pressure}
                              </Text>
                              <Text
                                style={[
                                  styles.hourlyStatLabel,
                                  { color: colors.secondary },
                                ]}
                              >
                                hPa
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderWeather = () => {
    const backgroundImage = getBackgroundImage();
    const colors = getThemeColors();

    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ImageBackground
          source={backgroundImage}
          style={styles.background}
          resizeMode="cover"
          blurRadius={darkMode ? 10 : 5}
          onLoad={() => setImageLoading(false)}
        >
          <SafeAreaView style={styles.safeArea}>
            <StatusBar
              barStyle={
                colors.text === "#FFFFFF" ? "light-content" : "dark-content"
              }
              translucent
              backgroundColor="transparent"
            />

            <View style={styles.weatherContainer}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTop}>
                  <Animated.View style={{ opacity: fadeAnim }}>
                    <TouchableOpacity
                      style={[
                        styles.headerButton,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => setShowIntro(true)}
                      activeOpacity={0.7}
                    >
                      <Icon name="home" size={18} color={colors.text} />
                    </TouchableOpacity>
                  </Animated.View>

                  <View style={styles.headerInfo}>
                    <Animated.View style={{ opacity: fadeAnim }}>
                      <View style={styles.timeContainer}>
                        <Icon
                          name="clock-o"
                          size={14}
                          color={colors.secondary}
                          style={styles.timeIcon}
                        />
                        <Text
                          style={[styles.currentTime, { color: colors.text }]}
                        >
                          {new Date().toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    </Animated.View>

                    {lastUpdate && (
                      <Animated.View style={{ opacity: fadeAnim }}>
                        <Text
                          style={[
                            styles.lastUpdate,
                            { color: colors.secondary },
                          ]}
                        >
                          آخر تحديث: {formatTime(lastUpdate)}
                        </Text>
                      </Animated.View>
                    )}

                    {!hasInternet && (
                      <Animated.View style={{ opacity: fadeAnim }}>
                        <View style={styles.networkWarning}>
                          <Icon name="wifi" size={12} color={colors.warning} />
                          <Text
                            style={[
                              styles.networkWarningText,
                              { color: colors.warning },
                            ]}
                          >
                            غير متصل
                          </Text>
                        </View>
                      </Animated.View>
                    )}
                  </View>

                  <View style={styles.headerRight}>
                    <Animated.View style={{ opacity: fadeAnim }}>
                      <TouchableOpacity
                        style={[
                          styles.headerButton,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            marginRight: 8,
                          },
                        ]}
                        onPress={toggleDarkMode}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name={darkMode ? "sun-o" : "moon-o"}
                          size={18}
                          color={darkMode ? colors.warning : colors.text}
                        />
                      </TouchableOpacity>
                    </Animated.View>

                    <Animated.View style={{ opacity: fadeAnim }}>
                      <TouchableOpacity
                        style={[
                          styles.headerButton,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => {
                          setShowSearchHistory(!showSearchHistory);
                          Keyboard.dismiss();
                        }}
                        activeOpacity={0.7}
                      >
                        <Icon name="history" size={18} color={colors.text} />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </View>

                {/* Search History Dropdown */}
                {showSearchHistory && searchHistory.length > 0 && (
                  <Animated.View
                    style={[
                      styles.searchHistoryDropdown,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: fadeAnim,
                      },
                    ]}
                  >
                    <View style={styles.searchHistoryDropdownHeader}>
                      <Text
                        style={[
                          styles.searchHistoryDropdownTitle,
                          { color: colors.text },
                        ]}
                      >
                        سجل البحث
                      </Text>
                      <TouchableOpacity onPress={clearSearchHistory}>
                        <Text
                          style={[
                            styles.clearHistoryText,
                            { color: colors.accent },
                          ]}
                        >
                          مسح الكل
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {searchHistory.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.searchHistoryItem}
                        onPress={() => {
                          setCity(item);
                          fetchByCity(item);
                          setShowSearchHistory(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name="history"
                          size={14}
                          color={colors.secondary}
                        />
                        <Text
                          style={[
                            styles.searchHistoryText,
                            { color: colors.text },
                          ]}
                        >
                          {item}
                        </Text>
                        <Icon
                          name="chevron-left"
                          size={14}
                          color={colors.secondary}
                        />
                      </TouchableOpacity>
                    ))}
                  </Animated.View>
                )}

                <View style={styles.searchSection}>
                  <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <TouchableOpacity
                      style={[
                        styles.searchContainer,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => searchInputRef.current?.focus()}
                      activeOpacity={1}
                    >
                      <Icon
                        name="search"
                        size={16}
                        color={colors.secondary}
                        style={styles.searchIcon}
                      />
                      <TextInput
                        ref={searchInputRef}
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="ابحث عن مدينة..."
                        placeholderTextColor={colors.secondary}
                        value={city}
                        onChangeText={setCity}
                        onSubmitEditing={handleSearchSubmit}
                        editable={hasInternet}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                      {city.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setCity("")}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Icon
                            name="times-circle"
                            size={16}
                            color={colors.secondary}
                          />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  </Animated.View>

                  <View style={styles.headerActions}>
                    <Animated.View style={{ opacity: fadeAnim }}>
                      <TouchableOpacity
                        style={[
                          styles.refreshButton,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            marginRight: 8,
                          },
                        ]}
                        onPress={handleRefresh}
                        disabled={refreshing || !hasInternet}
                        activeOpacity={0.7}
                      >
                        {refreshing ? (
                          <ActivityIndicator size="small" color={colors.text} />
                        ) : (
                          <Icon
                            name="refresh"
                            size={18}
                            color={hasInternet ? colors.text : colors.secondary}
                          />
                        )}
                      </TouchableOpacity>
                    </Animated.View>

                    <Animated.View style={{ opacity: fadeAnim }}>
                      <TouchableOpacity
                        style={[
                          styles.locationButton,
                          {
                            backgroundColor: colors.accent,
                          },
                        ]}
                        onPress={getLocation}
                        disabled={!hasInternet}
                        activeOpacity={0.7}
                      >
                        <Icon name="location-arrow" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </View>
              </View>

              {!keyboardVisible && (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={handleRefresh}
                      tintColor={colors.text}
                      colors={[colors.accent]}
                      enabled={hasInternet}
                    />
                  }
                >
                  {/* Current Weather */}
                  <Animated.View
                    style={[
                      styles.currentWeatherCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                      },
                    ]}
                  >
                    <View style={styles.cityHeader}>
                      <Text style={[styles.cityName, { color: colors.text }]}>
                        {weather.name}
                        {weather.sys?.country && (
                          <Text style={{ color: colors.secondary }}>
                            , {weather.sys.country}
                          </Text>
                        )}
                      </Text>
                      <Icon name="map-marker" size={16} color={colors.accent} />
                    </View>

                    <Text
                      style={[styles.currentDate, { color: colors.secondary }]}
                    >
                      {formatDate(Date.now())}
                    </Text>

                    <View style={styles.tempSection}>
                      <Image
                        source={{
                          uri: `https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`,
                        }}
                        style={styles.weatherIcon}
                        resizeMode="contain"
                        onLoad={() => setImageLoading(false)}
                        onError={() => setImageLoading(false)}
                      />
                      <View style={styles.tempInfo}>
                        <Text
                          style={[styles.currentTemp, { color: colors.text }]}
                        >
                          {formatTemperature(weather.main.temp)}
                        </Text>
                        <Text
                          style={[
                            styles.feelsLike,
                            { color: colors.secondary },
                          ]}
                        >
                          يشعر كـ {formatTemperature(weather.main.feels_like)}
                        </Text>
                        <View style={styles.tempRangeCurrent}>
                          <View style={styles.tempRangeItem}>
                            <Icon
                              name="arrow-up"
                              size={12}
                              color={colors.error}
                            />
                            <Text
                              style={[
                                styles.tempRangeText,
                                { color: colors.secondary },
                              ]}
                            >
                              {formatTemperature(weather.main.temp_max)}
                            </Text>
                          </View>
                          <View style={styles.tempRangeItem}>
                            <Icon
                              name="arrow-down"
                              size={12}
                              color={colors.accent}
                            />
                            <Text
                              style={[
                                styles.tempRangeText,
                                { color: colors.secondary },
                              ]}
                            >
                              {formatTemperature(weather.main.temp_min)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.weatherDescription,
                        { color: colors.text },
                      ]}
                    >
                      {weather.weather[0].description}
                    </Text>
                  </Animated.View>

                  {/* Hourly Forecast Section */}
                  {hourlyForecast.length > 0 && (
                    <Animated.View
                      style={[
                        styles.hourlySection,
                        {
                          opacity: fadeAnim,
                          transform: [{ translateY: slideAnim }],
                        },
                      ]}
                    >
                      <View style={styles.sectionHeader}>
                        <Icon name="clock-o" size={20} color={colors.text} />
                        <Text
                          style={[styles.sectionTitle, { color: colors.text }]}
                        >
                          توقعات كل ساعة
                        </Text>
                        <Text
                          style={[
                            styles.sectionSubtitle,
                            { color: colors.secondary },
                          ]}
                        >
                          خلال الـ24 ساعة القادمة
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.hourlyContainer,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <ScrollView
                          ref={hourlyScrollRef}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.hourlyScroll}
                          contentContainerStyle={styles.hourlyScrollContent}
                          decelerationRate="fast"
                          snapToInterval={88}
                        >
                          {hourlyForecast.map((hour, index) => (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.hourlyCard,
                                { borderColor: colors.border },
                              ]}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.hourlyTime,
                                  { color: colors.text },
                                ]}
                              >
                                {hour.time}
                              </Text>
                              {hour.pop > 30 && (
                                <View style={styles.rainIndicator}>
                                  <Icon
                                    name="tint"
                                    size={10}
                                    color={colors.accent}
                                  />
                                  <Text
                                    style={[
                                      styles.rainPercentage,
                                      { color: colors.accent },
                                    ]}
                                  >
                                    {hour.pop}%
                                  </Text>
                                </View>
                              )}
                              <Image
                                source={{
                                  uri: `https://openweathermap.org/img/wn/${hour.icon}.png`,
                                }}
                                style={styles.hourlyWeatherIcon}
                                resizeMode="contain"
                                onLoad={() => setImageLoading(false)}
                                onError={() => setImageLoading(false)}
                              />
                              <Text
                                style={[
                                  styles.hourlyTemp,
                                  { color: colors.text },
                                ]}
                              >
                                {formatTemperature(hour.temp)}
                              </Text>
                              <View style={styles.hourlyDetailsMini}>
                                <Icon
                                  name="wind"
                                  size={12}
                                  color={colors.accent}
                                />
                                <Text
                                  style={[
                                    styles.hourlyDetailText,
                                    { color: colors.secondary },
                                  ]}
                                >
                                  {hour.wind} كم/س
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </Animated.View>
                  )}

                  {/* Weather Details Grid */}
                  <Animated.View
                    style={[
                      styles.detailsGrid,
                      {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                      },
                    ]}
                  >
                    <View style={styles.detailsRow}>
                      <TouchableOpacity
                        style={[
                          styles.detailCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.detailIconContainer,
                            { backgroundColor: colors.accent + "20" },
                          ]}
                        >
                          <Icon name="wind" size={20} color={colors.accent} />
                        </View>
                        <Text
                          style={[styles.detailValue, { color: colors.text }]}
                        >
                          {Math.round(weather.wind.speed * 3.6)} كم/س
                        </Text>
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: colors.secondary },
                          ]}
                        >
                          سرعة الرياح
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.detailCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.detailIconContainer,
                            { backgroundColor: colors.accent + "20" },
                          ]}
                        >
                          <Icon name="tint" size={20} color={colors.accent} />
                        </View>
                        <Text
                          style={[styles.detailValue, { color: colors.text }]}
                        >
                          {weather.main.humidity}%
                        </Text>
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: colors.secondary },
                          ]}
                        >
                          الرطوبة
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.detailsRow}>
                      <TouchableOpacity
                        style={[
                          styles.detailCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.detailIconContainer,
                            { backgroundColor: colors.accent + "20" },
                          ]}
                        >
                          <Icon
                            name="tachometer"
                            size={20}
                            color={colors.accent}
                          />
                        </View>
                        <Text
                          style={[styles.detailValue, { color: colors.text }]}
                        >
                          {weather.main.pressure} hPa
                        </Text>
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: colors.secondary },
                          ]}
                        >
                          الضغط
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.detailCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.detailIconContainer,
                            { backgroundColor: colors.accent + "20" },
                          ]}
                        >
                          <Icon name="eye" size={20} color={colors.accent} />
                        </View>
                        <Text
                          style={[styles.detailValue, { color: colors.text }]}
                        >
                          {weather.visibility / 1000} كم
                        </Text>
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: colors.secondary },
                          ]}
                        >
                          الرؤية
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>

                  {/* 5-Day Forecast */}
                  {forecast.length > 0 && (
                    <Animated.View
                      style={[
                        styles.forecastSection,
                        {
                          opacity: fadeAnim,
                          transform: [{ translateY: slideAnim }],
                        },
                      ]}
                    >
                      <View style={styles.sectionHeader}>
                        <Icon name="calendar" size={20} color={colors.text} />
                        <Text
                          style={[styles.sectionTitle, { color: colors.text }]}
                        >
                          توقعات 5 أيام
                        </Text>
                        <TouchableOpacity
                          style={styles.seeAllButton}
                          onPress={() => showDayDetails(0)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.seeAllText,
                              { color: colors.accent },
                            ]}
                          >
                            عرض الكل
                          </Text>
                          <Icon
                            name="chevron-left"
                            size={12}
                            color={colors.accent}
                          />
                        </TouchableOpacity>
                      </View>

                      <View
                        style={[
                          styles.forecastContainer,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        {forecast.map((day, index) => {
                          const date = new Date(day.dt * 1000);
                          const isToday = index === 0;

                          return (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.forecastDayCard,
                                { borderColor: colors.border },
                              ]}
                              onPress={() => showDayDetails(index)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.forecastContent}>
                                <View style={styles.forecastHeader}>
                                  <View>
                                    <Text
                                      style={[
                                        styles.forecastDay,
                                        {
                                          color: colors.text,
                                          fontWeight: isToday ? "700" : "600",
                                        },
                                      ]}
                                    >
                                      {day.dayName}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.forecastDate,
                                        { color: colors.secondary },
                                      ]}
                                    >
                                      {date.getDate()}{" "}
                                      {date.toLocaleDateString("ar-EG", {
                                        month: "short",
                                      })}
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    style={styles.dotsMenuButton}
                                    onPress={() => showDayDetails(index)}
                                    hitSlop={{
                                      top: 10,
                                      bottom: 10,
                                      left: 10,
                                      right: 10,
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Icon
                                      name="ellipsis-h"
                                      size={18}
                                      color={colors.secondary}
                                    />
                                  </TouchableOpacity>
                                </View>

                                <View style={styles.forecastCenter}>
                                  <Image
                                    source={{
                                      uri: `https://openweathermap.org/img/wn/${day.weather[0].icon}.png`,
                                    }}
                                    style={styles.forecastIcon}
                                    resizeMode="contain"
                                    onLoad={() => setImageLoading(false)}
                                    onError={() => setImageLoading(false)}
                                  />
                                  <Text
                                    style={[
                                      styles.forecastTemp,
                                      { color: colors.text },
                                    ]}
                                  >
                                    {formatTemperature(day.main.temp)}
                                  </Text>
                                </View>

                                <View style={styles.forecastFooter}>
                                  <View style={styles.tempRange}>
                                    <Icon
                                      name="arrow-up"
                                      size={12}
                                      color={colors.error}
                                    />
                                    <Text
                                      style={[
                                        styles.forecastTempHigh,
                                        { color: colors.secondary },
                                      ]}
                                    >
                                      {formatTemperature(day.main.temp_max)}
                                    </Text>
                                  </View>
                                  <View style={styles.tempRange}>
                                    <Icon
                                      name="arrow-down"
                                      size={12}
                                      color={colors.accent}
                                    />
                                    <Text
                                      style={[
                                        styles.forecastTempLow,
                                        { color: colors.secondary },
                                      ]}
                                    >
                                      {formatTemperature(day.main.temp_min)}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </Animated.View>
                  )}

                  {/* Additional Info */}
                  <Animated.View
                    style={[
                      styles.additionalInfo,
                      {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.infoCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={styles.infoIconContainer}>
                        <Icon name="sunrise" size={24} color={colors.warning} />
                      </View>
                      <View style={styles.infoContent}>
                        <Text
                          style={[
                            styles.infoLabel,
                            { color: colors.secondary },
                          ]}
                        >
                          شروق الشمس
                        </Text>
                        <Text
                          style={[styles.infoValue, { color: colors.text }]}
                        >
                          {formatTime(weather.sys.sunrise * 1000)}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.infoCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View style={styles.infoIconContainer}>
                        <Icon name="sunset" size={24} color="#8B5CF6" />
                      </View>
                      <View style={styles.infoContent}>
                        <Text
                          style={[
                            styles.infoLabel,
                            { color: colors.secondary },
                          ]}
                        >
                          غروب الشمس
                        </Text>
                        <Text
                          style={[styles.infoValue, { color: colors.text }]}
                        >
                          {formatTime(weather.sys.sunset * 1000)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Footer */}
                  <View style={styles.footer}>
                    <Text
                      style={[styles.watermark, { color: colors.watermark }]}
                    >
                      تمت برمجته بواسطة إسلام هدايا
                    </Text>
                    <Text
                      style={[styles.appVersion, { color: colors.secondary }]}
                    >
                      الإصدار 2.0.0
                    </Text>
                  </View>
                </ScrollView>
              )}
              <UpdateModal
                visible={showModal}
                updateInfo={updateInfo}
                onClose={() => setShowModal(false)}
              />
            </View>
          </SafeAreaView>

          {/* Hourly Details Modal */}
          {renderHourlyModal()}
        </ImageBackground>
      </TouchableWithoutFeedback>
    );
  };

  // تحديد الشاشة المناسبة للعرض
  if (loading && !weather) {
    return renderLoading();
  }

  if (showIntro && !weather) {
    return renderIntroScreen();
  }

  if (!hasInternet && !weather && !showIntro) {
    return renderNoInternetScreen();
  }

  if (weather) {
    return renderWeather();
  }

  return renderIntroScreen();
}
