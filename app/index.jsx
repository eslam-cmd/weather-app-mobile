import axios from "axios";
import * as Location from "expo-location";
import * as Network from "expo-network";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const API_KEY = "d70c50f8af041fbc683cce05ef1d1cab";
const { width, height } = Dimensions.get("window");
const isIOS = Platform.OS === "ios";

// تحميل الصور بشكل ثابت
const weatherImages = {
  // صور النهار
  "day-clear": require("../assets/images/light-summer.jpg"),
  "day-rain": require("../assets/images/light-rain.jpg"),
  "day-cloudy": require("../assets/images/light-cloudy.jpg"),
  "day-snow": require("../assets/images/light-snow.jpg"),
  "day-windy": require("../assets/images/light-cloudy.jpg"),
  "day-default": require("../assets/images/default.jpg"),

  // صور الليل
  "night-clear": require("../assets/images/night.jpg"),
  "night-rain": require("../assets/images/night-rain.jpg"),
  "night-cloudy": require("../assets/images/night-cloudy.jpg"),
  "night-snow": require("../assets/images/night-snow.jpg"),
  "night-windy": require("../assets/images/night-cloudy.jpg"),
  "night-default": require("../assets/images/night.jpg"),

  // صورة افتراضية
  default: require("../assets/images/default.jpg"),
};

export default function WeatherApp() {
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

  const spinValue = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const forecastScrollRef = useRef(null);
  const hourlyScrollRef = useRef(null);

  // التحقق من اتصال الإنترنت
  const checkInternetConnection = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      setHasInternet(
        networkState.isConnected && networkState.isInternetReachable
      );
      return networkState.isConnected && networkState.isInternetReachable;
    } catch (error) {
      console.log("Network check error:", error);
      setHasInternet(false);
      return false;
    }
  };

  useEffect(() => {
    checkInternetConnection();

    // التحقق الدوري من الإنترنت
    const interval = setInterval(checkInternetConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading && weather) {
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
  }, [loading, weather]);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const getBackgroundImage = () => {
    if (!weather) {
      return weatherImages["default"];
    }

    const desc = weather.weather[0].description.toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    const { sunrise, sunset } = weather.sys || {};
    const isNight = sunrise && sunset ? now < sunrise || now > sunset : false;

    const timePrefix = isNight ? "night" : "day";

    if (desc.includes("مطر") || desc.includes("رذاذ")) {
      return (
        weatherImages[`${timePrefix}-rain`] ||
        weatherImages[`${timePrefix}-default`]
      );
    } else if (desc.includes("غيوم") || desc.includes("غائم")) {
      return (
        weatherImages[`${timePrefix}-cloudy`] ||
        weatherImages[`${timePrefix}-default`]
      );
    } else if (desc.includes("ثلج")) {
      return (
        weatherImages[`${timePrefix}-snow`] ||
        weatherImages[`${timePrefix}-default`]
      );
    } else if (desc.includes("عاصف") || desc.includes("ريح")) {
      return (
        weatherImages[`${timePrefix}-windy`] ||
        weatherImages[`${timePrefix}-default`]
      );
    } else {
      return weatherImages[`${timePrefix}-clear`] || weatherImages["default"];
    }
  };

  // تحديد لون النص بناءً على الخلفية والوضع الداكن
  const getTextColor = () => {
    const isDarkTheme = darkMode;

    if (!weather) return "#FFFFFF";

    const desc = weather.weather[0].description.toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    const { sunrise, sunset } = weather.sys || {};
    const isNight = sunrise && sunset ? now < sunrise || now > sunset : false;

    // إذا كان الوضع الداكن مفعلاً أو الليل، نستخدم ألوان فاتحة
    if (isDarkTheme || isNight) {
      return "#FFFFFF";
    }

    // إذا كان الطقس مشمساً في النهار، نستخدم ألوان داكنة
    if (
      !isNight &&
      !desc.includes("مطر") &&
      !desc.includes("غيوم") &&
      !desc.includes("غائم")
    ) {
      return "#1E293B";
    }

    // في حالات أخرى نستخدم ألوان فاتحة
    return "#FFFFFF";
  };

  const getSecondaryColor = () => {
    const textColor = getTextColor();

    // إذا كان اللون الأساسي فاتح (أبيض)، نستخدم رمادي فاتح
    if (textColor === "#FFFFFF") {
      return "rgba(255,255,255,0.8)";
    }

    // إذا كان اللون الأساسي داكن، نستخدم رمادي داكن
    return "rgba(30,41,59,0.7)";
  };

  const getCardColor = () => {
    const textColor = getTextColor();

    // إذا كان اللون الأساسي فاتح، نستخدم خلفية داكنة شفافة
    if (textColor === "#FFFFFF") {
      return darkMode ? "rgba(28,28,30,0.85)" : "rgba(0,0,0,0.4)";
    }

    // إذا كان اللون الأساسي داكن، نستخدم خلفية فاتحة شفافة
    return "rgba(255,255,255,0.85)";
  };

  const getWatermarkColor = () => {
    const textColor = getTextColor();

    if (textColor === "#FFFFFF") {
      return "rgba(255,255,255,0.6)";
    }

    return "rgba(30,41,59,0.6)";
  };

  const processHourlyForecast = (list) => {
    // عرض التوقعات للساعات الـ24 القادمة
    const now = new Date();
    const next24Hours = list
      .filter((item) => {
        const itemTime = new Date(item.dt * 1000);
        const diffHours = (itemTime - now) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= 24;
      })
      .slice(0, 8); // عرض أول 8 ساعات فقط

    return next24Hours.map((item) => ({
      time: new Date(item.dt * 1000).toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      temp: Math.round(item.main.temp),
      icon: item.weather[0].icon,
      description: item.weather[0].description,
      humidity: item.main.humidity,
      wind: item.wind.speed,
      feels_like: Math.round(item.main.feels_like),
    }));
  };

  const processDetailedForecast = (list) => {
    const byDay = {};
    list.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().slice(0, 10);
      if (!byDay[dayKey]) {
        byDay[dayKey] = {
          dayName: date.toLocaleDateString("ar-EG", { weekday: "long" }),
          date: date.toLocaleDateString("ar-EG", {
            day: "numeric",
            month: "long",
          }),
          hourly: [],
          summary: {
            temp_max: -Infinity,
            temp_min: Infinity,
            mainWeather: item.weather[0].main,
            description: item.weather[0].description,
          },
        };
      }
      byDay[dayKey].hourly.push({
        time: date.toLocaleTimeString("ar-EG", { hour: "2-digit" }),
        hour: date.getHours(),
        temp: Math.round(item.main.temp),
        feels_like: Math.round(item.main.feels_like),
        humidity: item.main.humidity,
        wind: item.wind.speed,
        pressure: item.main.pressure,
        icon: item.weather[0].icon,
        description: item.weather[0].description,
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
    });

    // تحويل إلى مصفوفة وترتيب حسب التاريخ
    return Object.keys(byDay)
      .sort()
      .slice(0, 5)
      .map((dayKey) => ({
        dateKey: dayKey,
        ...byDay[dayKey],
      }));
  };

  const fetchWeatherData = async (cityName = null, lat = null, lon = null) => {
    if (!hasInternet) {
      alert(
        "⚠️ لا يوجد اتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى."
      );
      return;
    }

    try {
      setLoading(true);
      setShowIntro(false);

      let urlCurrent, urlForecast;

      if (cityName) {
        urlCurrent = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${API_KEY}&units=metric&lang=ar`;
        urlForecast = `https://api.openweathermap.org/data/2.5/forecast?q=${cityName}&appid=${API_KEY}&units=metric&lang=ar`;
      } else {
        urlCurrent = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ar`;
        urlForecast = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ar`;
      }

      const [currentRes, forecastRes] = await Promise.all([
        axios.get(urlCurrent),
        axios.get(urlForecast),
      ]);

      setWeather(currentRes.data);
      setCity(currentRes.data.name);

      // معالجة البيانات للتوقعات
      const hourlyData = processHourlyForecast(forecastRes.data.list);
      const detailedData = processDetailedForecast(forecastRes.data.list);

      setHourlyForecast(hourlyData);
      setDetailedForecast(detailedData);

      // تعيين التوقعات اليومية المبسطة للعرض الرئيسي
      setForecast(
        detailedData.map((day) => ({
          dt: new Date(day.dateKey).getTime() / 1000,
          main: {
            temp: day.hourly[Math.floor(day.hourly.length / 2)]?.temp || 20,
            temp_max: Math.round(day.summary.temp_max),
            temp_min: Math.round(day.summary.temp_min),
          },
          weather: [
            {
              icon:
                day.hourly[Math.floor(day.hourly.length / 2)]?.icon || "01d",
              description: day.summary.description,
            },
          ],
        }))
      );
    } catch (err) {
      console.log("Error:", err?.response?.data || err.message);
      if (err.response?.status === 404) {
        alert(
          "⚠️ لم يتم العثور على المدينة. يرجى التحقق من الاسم والمحاولة مرة أخرى."
        );
      } else {
        alert("⚠️ حدث خطأ في جلب البيانات. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchByCity = async (cityName) => {
    await fetchWeatherData(cityName);
  };

  const fetchByCoords = async (lat, lon) => {
    await fetchWeatherData(null, lat, lon);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    if (weather?.coord) {
      await fetchByCoords(weather.coord.lat, weather.coord.lon);
    } else if (city.trim()) {
      await fetchByCity(city.trim());
    } else {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          await fetchByCoords(
            location.coords.latitude,
            location.coords.longitude
          );
        }
      } catch (error) {
        console.log("Refresh error:", error);
        setRefreshing(false);
      }
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("⚠️ يرجى منح إذن الموقع لاستخدام الموقع الحالي.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      fetchByCoords(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      console.log("Location error:", error);
      alert("⚠️ حدث خطأ في الحصول على الموقع.");
    }
  };

  const showDayDetails = (dayIndex) => {
    setSelectedDayIndex(dayIndex);
    if (detailedForecast[dayIndex]) {
      setSelectedDayHourly(detailedForecast[dayIndex].hourly);
      setShowHourlyModal(true);
    }
  };

  useEffect(() => {
    if (hasInternet) {
      getLocation();
    }
  }, [hasInternet]);

  const renderNoInternetScreen = () => (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: darkMode ? "#1C1C1E" : "#8B0000" },
      ]}
    >
      <View style={styles.noInternetContainer}>
        <Icon
          name="wifi"
          size={80}
          color="#FFFFFF"
          style={styles.noInternetIcon}
        />
        <Text style={styles.noInternetTitle}>⚠️ لا يوجد اتصال بالإنترنت</Text>
        <Text style={styles.noInternetText}>
          يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى
        </Text>
        <TouchableOpacity
          style={[
            styles.retryButton,
            {
              backgroundColor: darkMode
                ? "rgba(255,255,255,0.2)"
                : "rgba(255,255,255,0.3)",
            },
          ]}
          onPress={() => {
            checkInternetConnection().then((connected) => {
              if (connected) {
                getLocation();
              } else {
                alert("⚠️ لا يزال الاتصال غير متوفر.");
              }
            });
          }}
        >
          <Icon name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.offlineButton,
            {
              backgroundColor: darkMode
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.2)",
            },
          ]}
          onPress={() => setShowIntro(true)}
        >
          <Text style={styles.offlineButtonText}>العودة للواجهة الرئيسية</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const renderIntroScreen = () => (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: darkMode ? "#1C1C1E" : "#007AFF" },
      ]}
    >
      <View style={styles.introContainer}>
        <Animated.View style={[styles.introContent, { opacity: fadeAnim }]}>
          <View style={styles.introIconContainer}>
            <Icon
              name="cloud"
              size={90}
              color="#FFFFFF"
              style={styles.introIcon}
            />
          </View>

          <Text style={styles.introTitle}>🌤️ تطبيق الطقس</Text>
          <Text style={styles.introSubtitle}>
            استكشف حالة الطقس في أي مكان حول العالم
          </Text>

          {!hasInternet && (
            <View style={styles.offlineWarning}>
              <Icon name="exclamation-triangle" size={20} color="#FFD700" />
              <Text style={styles.offlineWarningText}>وضع عدم الاتصال</Text>
            </View>
          )}

          <View style={styles.introButtons}>
            <TouchableOpacity
              style={[
                styles.introButton,
                {
                  backgroundColor: darkMode
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.25)",
                },
              ]}
              onPress={getLocation}
              disabled={!hasInternet}
            >
              <Icon
                name="location-arrow"
                size={22}
                color={hasInternet ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
                style={styles.buttonIcon}
              />
              <Text
                style={[
                  styles.introButtonText,
                  { color: hasInternet ? "#FFFFFF" : "rgba(255,255,255,0.5)" },
                ]}
              >
                الموقع الحالي
              </Text>
            </TouchableOpacity>

            <View style={styles.orContainer}>
              <View
                style={[
                  styles.orLine,
                  {
                    backgroundColor: darkMode
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(255,255,255,0.3)",
                  },
                ]}
              />
              <Text
                style={[
                  styles.orText,
                  {
                    color: darkMode
                      ? "rgba(255,255,255,0.5)"
                      : "rgba(255,255,255,0.7)",
                  },
                ]}
              >
                أو
              </Text>
              <View
                style={[
                  styles.orLine,
                  {
                    backgroundColor: darkMode
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(255,255,255,0.3)",
                  },
                ]}
              />
            </View>

            <View style={styles.searchIntroContainer}>
              <TextInput
                style={[
                  styles.searchIntroInput,
                  {
                    backgroundColor: darkMode
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(255,255,255,0.2)",
                  },
                ]}
                placeholder="🔍 ابحث عن مدينة..."
                placeholderTextColor={
                  darkMode ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.7)"
                }
                value={city}
                onChangeText={setCity}
                onSubmitEditing={() =>
                  hasInternet && city.trim() && fetchByCity(city.trim())
                }
                editable={hasInternet}
              />
              <TouchableOpacity
                style={[
                  styles.searchIntroButton,
                  {
                    backgroundColor: darkMode
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.25)",
                  },
                ]}
                onPress={() =>
                  hasInternet && city.trim() && fetchByCity(city.trim())
                }
                disabled={!hasInternet || !city.trim()}
              >
                <Icon
                  name="search"
                  size={22}
                  color={hasInternet ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
                />
              </TouchableOpacity>
            </View>
          </View>

          <Text
            style={[
              styles.introHint,
              {
                color: darkMode
                  ? "rgba(255,255,255,0.5)"
                  : "rgba(255,255,255,0.7)",
              },
            ]}
          >
            💡 يمكنك تغيير مظهر التطبيق باستخدام زر القمر/الشمس
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );

  const renderLoading = () => (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: darkMode ? "#1C1C1E" : "#007AFF" },
      ]}
    >
      <View style={styles.loadingContainer}>
        <Animated.View
          style={[styles.loadingContent, { transform: [{ rotate: spin }] }]}
        >
          <Icon name="cloud" size={70} color="#FFFFFF" />
        </Animated.View>
        <Text style={styles.loadingText}>جاري تحميل بيانات الطقس...</Text>
        <View style={styles.loadingDots}>
          <Animated.View style={[styles.loadingDot, { opacity: fadeAnim }]} />
          <Animated.View style={[styles.loadingDot, { opacity: fadeAnim }]} />
          <Animated.View style={[styles.loadingDot, { opacity: fadeAnim }]} />
        </View>
      </View>
    </SafeAreaView>
  );

  const renderHourlyModal = () => {
    const textColor = getTextColor();
    const secondaryColor = getSecondaryColor();
    const cardColor = getCardColor();

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showHourlyModal}
        onRequestClose={() => setShowHourlyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: cardColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {selectedDayHourly.length > 0 && (
                  <>
                    {detailedForecast[selectedDayIndex]?.dayName} -
                    {detailedForecast[selectedDayIndex]?.date}
                  </>
                )}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowHourlyModal(false)}
              >
                <Icon name="times" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              {selectedDayHourly.map((hour, index) => (
                <View
                  key={index}
                  style={[
                    styles.hourlyItem,
                    {
                      backgroundColor: darkMode
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                      marginBottom:
                        index < selectedDayHourly.length - 1 ? 10 : 0,
                    },
                  ]}
                >
                  <View style={styles.hourlyItemHeader}>
                    <Text style={[styles.hourlyTime, { color: textColor }]}>
                      {hour.time}
                    </Text>
                    <View style={styles.hourlyTempMain}>
                      <Text style={[styles.hourlyTemp, { color: textColor }]}>
                        {hour.temp}°
                      </Text>
                      <Text
                        style={[
                          styles.hourlyFeelsLike,
                          { color: secondaryColor },
                        ]}
                      >
                        يشعر كـ {hour.feels_like}°
                      </Text>
                    </View>
                  </View>

                  <View style={styles.hourlyDetails}>
                    {hour.icon && (
                      <Image
                        source={{
                          uri: `https://openweathermap.org/img/wn/${hour.icon}.png`,
                        }}
                        style={styles.hourlyIcon}
                      />
                    )}
                    <Text
                      style={[styles.hourlyDescription, { color: textColor }]}
                    >
                      {hour.description}
                    </Text>
                  </View>

                  <View style={styles.hourlyStats}>
                    <View style={styles.hourlyStat}>
                      <Icon name="tint" size={16} color="#3B82F6" />
                      <Text
                        style={[styles.hourlyStatText, { color: textColor }]}
                      >
                        {hour.humidity}%
                      </Text>
                    </View>
                    <View style={styles.hourlyStat}>
                      <Icon name="wind" size={16} color="#3B82F6" />
                      <Text
                        style={[styles.hourlyStatText, { color: textColor }]}
                      >
                        {hour.wind} م/ث
                      </Text>
                    </View>
                    <View style={styles.hourlyStat}>
                      <Icon name="tachometer" size={16} color="#3B82F6" />
                      <Text
                        style={[styles.hourlyStatText, { color: textColor }]}
                      >
                        {hour.pressure} hPa
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderWeather = () => {
    const backgroundImage = getBackgroundImage();
    const textColor = getTextColor();
    const secondaryColor = getSecondaryColor();
    const cardColor = getCardColor();
    const watermarkColor = getWatermarkColor();

    return (
      <ImageBackground
        source={backgroundImage}
        style={styles.background}
        blurRadius={5}
      >
        <SafeAreaView style={styles.safeArea}>
          <StatusBar
            barStyle={
              textColor === "#FFFFFF" ? "light-content" : "dark-content"
            }
            translucent
            backgroundColor="transparent"
          />

          <View style={styles.weatherContainer}>
            {/* Header with Search */}
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <TouchableOpacity
                  style={[styles.headerButton, { backgroundColor: cardColor }]}
                  onPress={() => setShowIntro(true)}
                >
                  <Icon name="home" size={18} color={textColor} />
                </TouchableOpacity>

                <View style={styles.headerInfo}>
                  <Text style={[styles.currentTime, { color: textColor }]}>
                    {new Date().toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  {!hasInternet && (
                    <View style={styles.networkWarning}>
                      <Icon name="wifi" size={12} color="#FFD700" />
                      <Text style={styles.networkWarningText}>غير متصل</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.headerButton, { backgroundColor: cardColor }]}
                  onPress={toggleDarkMode}
                >
                  <Icon
                    name={darkMode ? "sun-o" : "moon-o"}
                    size={18}
                    color={darkMode ? "#FFD700" : textColor}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.searchSection}>
                <View
                  style={[
                    styles.searchContainer,
                    { backgroundColor: cardColor },
                  ]}
                >
                  <Icon
                    name="search"
                    size={16}
                    color={secondaryColor}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={[styles.searchInput, { color: textColor }]}
                    placeholder="ابحث عن مدينة..."
                    placeholderTextColor={secondaryColor}
                    value={city}
                    onChangeText={setCity}
                    onSubmitEditing={() =>
                      hasInternet && city.trim() && fetchByCity(city.trim())
                    }
                    editable={hasInternet}
                  />
                  {city.length > 0 && (
                    <TouchableOpacity onPress={() => setCity("")}>
                      <Icon
                        name="times-circle"
                        size={16}
                        color={secondaryColor}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.refreshButton, { backgroundColor: cardColor }]}
                  onPress={handleRefresh}
                  disabled={refreshing || !hasInternet}
                >
                  {refreshing ? (
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                      <Icon
                        name="refresh"
                        size={18}
                        color={
                          hasInternet ? textColor : "rgba(255,255,255,0.3)"
                        }
                      />
                    </Animated.View>
                  ) : (
                    <Icon
                      name="refresh"
                      size={18}
                      color={hasInternet ? textColor : "rgba(255,255,255,0.3)"}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Current Weather */}
              <Animated.View
                style={[
                  styles.currentWeatherCard,
                  {
                    backgroundColor: cardColor,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <Text style={[styles.cityName, { color: textColor }]}>
                  {weather.name}
                </Text>

                <Text style={[styles.currentDate, { color: secondaryColor }]}>
                  {new Date().toLocaleDateString("ar-EG", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>

                <View style={styles.tempSection}>
                  <Image
                    source={{
                      uri: `https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`,
                    }}
                    style={styles.weatherIcon}
                  />
                  <View style={styles.tempInfo}>
                    <Text style={[styles.currentTemp, { color: textColor }]}>
                      {Math.round(weather.main.temp)}°
                    </Text>
                    <Text style={[styles.feelsLike, { color: secondaryColor }]}>
                      يشعر كـ {Math.round(weather.main.feels_like)}°
                    </Text>
                  </View>
                </View>

                <Text style={[styles.weatherDescription, { color: textColor }]}>
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
                    <Icon name="clock-o" size={20} color={textColor} />
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      توقعات كل ساعة
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.hourlyContainer,
                      { backgroundColor: cardColor },
                    ]}
                  >
                    <ScrollView
                      ref={hourlyScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.hourlyScroll}
                      contentContainerStyle={styles.hourlyScrollContent}
                    >
                      {hourlyForecast.map((hour, index) => (
                        <View key={index} style={styles.hourlyCard}>
                          <Text
                            style={[styles.hourlyTime, { color: textColor }]}
                          >
                            {hour.time}
                          </Text>
                          <Image
                            source={{
                              uri: `https://openweathermap.org/img/wn/${hour.icon}.png`,
                            }}
                            style={styles.hourlyWeatherIcon}
                          />
                          <Text
                            style={[styles.hourlyTemp, { color: textColor }]}
                          >
                            {hour.temp}°
                          </Text>
                          <View style={styles.hourlyDetailsMini}>
                            <Icon name="tint" size={12} color="#3B82F6" />
                            <Text
                              style={[
                                styles.hourlyDetailText,
                                { color: secondaryColor },
                              ]}
                            >
                              {hour.humidity}%
                            </Text>
                          </View>
                        </View>
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
                  <View
                    style={[styles.detailCard, { backgroundColor: cardColor }]}
                  >
                    <Icon name="wind" size={24} color="#3B82F6" />
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {weather.wind.speed} م/ث
                    </Text>
                    <Text
                      style={[styles.detailLabel, { color: secondaryColor }]}
                    >
                      سرعة الرياح
                    </Text>
                  </View>

                  <View
                    style={[styles.detailCard, { backgroundColor: cardColor }]}
                  >
                    <Icon name="tint" size={24} color="#3B82F6" />
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {weather.main.humidity}%
                    </Text>
                    <Text
                      style={[styles.detailLabel, { color: secondaryColor }]}
                    >
                      الرطوبة
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsRow}>
                  <View
                    style={[styles.detailCard, { backgroundColor: cardColor }]}
                  >
                    <Icon name="tachometer" size={24} color="#3B82F6" />
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {weather.main.pressure} hPa
                    </Text>
                    <Text
                      style={[styles.detailLabel, { color: secondaryColor }]}
                    >
                      الضغط
                    </Text>
                  </View>

                  <View
                    style={[styles.detailCard, { backgroundColor: cardColor }]}
                  >
                    <Icon name="eye" size={24} color="#3B82F6" />
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {weather.visibility / 1000} كم
                    </Text>
                    <Text
                      style={[styles.detailLabel, { color: secondaryColor }]}
                    >
                      الرؤية
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* 5-Day Forecast with Dots Menu */}
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
                    <Icon name="calendar" size={20} color={textColor} />
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      توقعات 5 أيام
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.forecastContainer,
                      { backgroundColor: cardColor },
                    ]}
                  >
                    <ScrollView
                      ref={forecastScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.forecastScroll}
                      contentContainerStyle={styles.forecastScrollContent}
                    >
                      {forecast.map((day, index) => {
                        const date = new Date(day.dt * 1000);
                        const dayName = date.toLocaleDateString("ar-EG", {
                          weekday: "short",
                        });
                        const dayNumber = date.getDate();
                        const month = date.toLocaleDateString("ar-EG", {
                          month: "short",
                        });

                        return (
                          <View key={index} style={styles.forecastDayCard}>
                            <View style={styles.forecastContent}>
                              <View style={styles.forecastHeader}>
                                <Text
                                  style={[
                                    styles.forecastDay,
                                    { color: textColor },
                                  ]}
                                >
                                  {dayName}
                                </Text>
                                <Text
                                  style={[
                                    styles.forecastDate,
                                    { color: secondaryColor },
                                  ]}
                                >
                                  {dayNumber} {month}
                                </Text>
                              </View>

                              <View style={styles.forecastCenter}>
                                <Image
                                  source={{
                                    uri: `https://openweathermap.org/img/wn/${day.weather[0].icon}.png`,
                                  }}
                                  style={styles.forecastIcon}
                                />
                                <Text
                                  style={[
                                    styles.forecastTemp,
                                    { color: textColor },
                                  ]}
                                >
                                  {Math.round(day.main.temp)}°
                                </Text>
                              </View>

                              <View style={styles.forecastFooter}>
                                <View style={styles.tempRange}>
                                  <Icon
                                    name="arrow-up"
                                    size={12}
                                    color="#EF4444"
                                  />
                                  <Text
                                    style={[
                                      styles.forecastTempHigh,
                                      { color: secondaryColor },
                                    ]}
                                  >
                                    {Math.round(day.main.temp_max)}°
                                  </Text>
                                </View>
                                <View style={styles.tempRange}>
                                  <Icon
                                    name="arrow-down"
                                    size={12}
                                    color="#3B82F6"
                                  />
                                  <Text
                                    style={[
                                      styles.forecastTempLow,
                                      { color: secondaryColor },
                                    ]}
                                  >
                                    {Math.round(day.main.temp_min)}°
                                  </Text>
                                </View>
                              </View>

                              {/* Three Dots Menu Button */}
                              <TouchableOpacity
                                style={styles.dotsMenuButton}
                                onPress={() => showDayDetails(index)}
                              >
                                <Icon
                                  name="ellipsis-h"
                                  size={20}
                                  color={secondaryColor}
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
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
                <View style={[styles.infoCard, { backgroundColor: cardColor }]}>
                  <Icon
                    name="sunrise"
                    size={20}
                    color="#F59E0B"
                    style={styles.infoIcon}
                  />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: secondaryColor }]}>
                      شروق الشمس
                    </Text>
                    <Text style={[styles.infoValue, { color: textColor }]}>
                      {new Date(weather.sys.sunrise * 1000).toLocaleTimeString(
                        "ar-EG",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </Text>
                  </View>
                </View>

                <View style={[styles.infoCard, { backgroundColor: cardColor }]}>
                  <Icon
                    name="sunset"
                    size={20}
                    color="#8B5CF6"
                    style={styles.infoIcon}
                  />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: secondaryColor }]}>
                      غروب الشمس
                    </Text>
                    <Text style={[styles.infoValue, { color: textColor }]}>
                      {new Date(weather.sys.sunset * 1000).toLocaleTimeString(
                        "ar-EG",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            </ScrollView>

            {/* Watermark */}
            <Text style={[styles.watermark, { color: watermarkColor }]}>
              تمت برمجته بواسطة إسلام هدايا
            </Text>
          </View>
        </SafeAreaView>

        {/* Hourly Details Modal */}
        {renderHourlyModal()}
      </ImageBackground>
    );
  };

  if (!hasInternet && !loading && !weather) {
    return renderNoInternetScreen();
  }

  if (showIntro && !loading && !weather) {
    return renderIntroScreen();
  }

  if (loading) {
    return renderLoading();
  }

  if (weather) {
    return renderWeather();
  }

  return renderIntroScreen();
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // No Internet Screen
  noInternetContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  noInternetIcon: {
    marginBottom: 24,
    opacity: 0.8,
  },
  noInternetTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  noInternetText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
    width: "100%",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  offlineButton: {
    padding: 16,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  offlineButtonText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "500",
  },

  // Intro Screen Styles
  introContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  introContent: {
    alignItems: "center",
    width: "100%",
  },
  introIconContainer: {
    marginBottom: 32,
  },
  introIcon: {
    opacity: 0.9,
  },
  introTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  introSubtitle: {
    fontSize: 17,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "400",
  },
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  offlineWarningText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "600",
  },
  introButtons: {
    width: "100%",
    gap: 20,
    marginBottom: 40,
  },
  introButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: 14,
    gap: 12,
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    }),
  },
  buttonIcon: {
    marginTop: 2,
  },
  introButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 8,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 15,
    fontWeight: "500",
  },
  searchIntroContainer: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  searchIntroInput: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 17,
    fontWeight: "400",
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    }),
  },
  searchIntroButton: {
    width: 60,
    height: 60,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    }),
  },
  introHint: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "400",
  },

  // Loading Screen Styles
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingContent: {
    marginBottom: 32,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 18,
    marginBottom: 24,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 12,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },

  // Weather Screen Styles
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  weatherContainer: {
    flex: 1,
  },
  header: {
    paddingTop: isIOS ? 60 : 40,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerInfo: {
    alignItems: "center",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    }),
  },
  networkWarning: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  networkWarningText: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "600",
  },
  currentTime: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  searchSection: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    }),
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    paddingVertical: 10,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    }),
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  currentWeatherCard: {
    borderRadius: 24,
    padding: 24,
    marginTop: 20,
    marginBottom: 24,
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    }),
  },
  cityName: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  currentDate: {
    fontSize: 17,
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "400",
  },
  tempSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  weatherIcon: {
    width: 120,
    height: 120,
    marginRight: -20,
  },
  tempInfo: {
    alignItems: "flex-start",
  },
  currentTemp: {
    fontSize: 72,
    fontWeight: "300",
    letterSpacing: -2,
  },
  feelsLike: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: -8,
  },
  weatherDescription: {
    fontSize: 20,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Hourly Forecast Section
  hourlySection: {
    marginBottom: 28,
  },
  hourlyContainer: {
    borderRadius: 24,
    paddingVertical: 16,
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    }),
  },
  hourlyScroll: {
    marginHorizontal: -4,
  },
  hourlyScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  hourlyCard: {
    width: 80,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginRight: 4,
  },
  hourlyTime: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  hourlyWeatherIcon: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },
  hourlyTemp: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  hourlyDetailsMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hourlyDetailText: {
    fontSize: 12,
    fontWeight: "500",
  },

  detailsGrid: {
    marginBottom: 28,
  },
  detailsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  detailCard: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    borderRadius: 20,
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    }),
  },
  detailValue: {
    fontSize: 24,
    fontWeight: "700",
    marginVertical: 8,
    letterSpacing: 0.5,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },

  // Forecast Section with Dots Menu
  forecastSection: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginLeft: 10,
  },
  forecastContainer: {
    borderRadius: 24,
    paddingVertical: 16,
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    }),
  },
  forecastScroll: {
    marginHorizontal: -4,
  },
  forecastScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  forecastDayCard: {
    width: width * 0.22,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginRight: 4,
  },
  forecastContent: {
    alignItems: "center",
    width: "100%",
    position: "relative",
  },
  forecastHeader: {
    alignItems: "center",
    marginBottom: 8,
  },
  forecastDay: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  forecastDate: {
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.8,
  },
  forecastCenter: {
    alignItems: "center",
    marginVertical: 8,
  },
  forecastIcon: {
    width: 45,
    height: 45,
    marginBottom: 8,
  },
  forecastTemp: {
    fontSize: 22,
    fontWeight: "800",
  },
  forecastFooter: {
    alignItems: "center",
    marginTop: 8,
  },
  tempRange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginVertical: 2,
  },
  forecastTempHigh: {
    fontSize: 13,
    fontWeight: "600",
  },
  forecastTempLow: {
    fontSize: 13,
    fontWeight: "600",
  },
  dotsMenuButton: {
    position: "absolute",
    top: 7,
    right: 10,
    width: 30,
    height: 30,
    justifyContent: "center",
  },

  additionalInfo: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    }),
  },
  infoIcon: {
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "700",
  },

  watermark: {
    position: "absolute",
    bottom: 20,
    right: 20,
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "400",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalScrollView: {
    maxHeight: height * 0.6,
  },
  hourlyItem: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  hourlyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  hourlyTempMain: {
    alignItems: "flex-end",
  },
  hourlyFeelsLike: {
    fontSize: 12,
    marginTop: 2,
  },
  hourlyDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  hourlyIcon: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  hourlyDescription: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  hourlyStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  hourlyStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hourlyStatText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
