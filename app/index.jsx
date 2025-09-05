import axios from "axios";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const API_KEY = "d70c50f8af041fbc683cce05ef1d1cab";
export default function WeatherApp() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  const spinValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
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
    if (!weather) return require("../assets/images/default.jpg");
    const desc = weather.weather[0].description.toLowerCase();
    if (desc.includes("مطر") || desc.includes("رذاذ"))
      return require("../assets/images/rain.jpg");
    if (desc.includes("غيوم") || desc.includes("غائم"))
      return require("../assets/images/cloudy.jpg");
    if (desc.includes("ثلج")) return require("../assets/images/snow.jpg");
    if (desc.includes("عاصف") || desc.includes("ريح"))
      return require("../assets/images/winy.jpg");
    return require("../assets/images/sunny.jpg");
  };

  // تلخيص forecast إلى 5 أيام (نختار قراءة منتصف اليوم إن وجدت، أو أول قراءة)
  const summarizeForecast = (list) => {
    const byDay = {};
    list.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
      const hour = date.getHours();
      if (!byDay[dayKey]) byDay[dayKey] = [];
      byDay[dayKey].push({ ...item, _hour: hour });
    });
    const days = Object.keys(byDay)
      .sort()
      .map((day) => {
        const targetHour = 12;
        let best = byDay[day][0];
        let bestDiff = Math.abs(byDay[day][0]._hour - targetHour);
        byDay[day].forEach((it) => {
          const diff = Math.abs(it._hour - targetHour);
          if (diff < bestDiff) {
            best = it;
            bestDiff = diff;
          }
        });
        return best;
      });

    return days.slice(0, 5);
  };

  const fetchByCity = async (cityName) => {
    try {
      setLoading(true);
      const [currentRes, forecastRes] = await Promise.all([
        axios.get(
          `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${API_KEY}&units=metric&lang=ar`
        ),
        axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?q=${cityName}&appid=${API_KEY}&units=metric&lang=ar`
        ),
      ]);
      setWeather(currentRes.data);
      setCity(currentRes.data.name);
      setForecast(summarizeForecast(forecastRes.data.list));
    } catch (err) {
      console.log(
        "City not found or API error",
        err?.response?.data || err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchByCoords = async (lat, lon) => {
    try {
      setLoading(true);
      const [currentRes, forecastRes] = await Promise.all([
        axios.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ar`
        ),
        axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ar`
        ),
      ]);
      setWeather(currentRes.data);
      setCity(currentRes.data.name);
      setForecast(summarizeForecast(forecastRes.data.list));
    } catch (err) {
      console.log("Coords error", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission denied");
        setLoading(false);
        return;
      }
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      fetchByCoords(location.coords.latitude, location.coords.longitude);
    })();
  }, []);

  return (
    <ImageBackground
      source={getBackgroundImage()}
      style={styles.background}
      blurRadius={3}
    >
      <ScrollView>
        <View style={styles.overlay}>
          {/* بحث المدينة */}
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 أدخل اسم المدينة"
            placeholderTextColor="#ccc"
            value={city}
            onChangeText={setCity}
            onSubmitEditing={() => {
              if (city?.trim()) fetchByCity(city.trim());
              Keyboard.dismiss();
            }}
          />

          {/* تحميل */}
          {loading && (
            <Animated.View
              style={{ transform: [{ rotate: spin }], marginTop: 50 }}
            >
              <Icon name="spinner" size={40} color="#fff" />
            </Animated.View>
          )}

          {!loading && weather && (
            <>
              {/* اليوم الحالي */}
              <Text style={styles.cityName}>{weather.name}</Text>
              <Text style={styles.date}>
                {new Date().toLocaleDateString("ar-EG", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>

              <Image
                source={{
                  uri: `https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`,
                }}
                style={styles.weatherIcon}
              />
              <Text style={styles.temp}>{Math.round(weather.main.temp)}°C</Text>
              <Text style={styles.description}>
                {weather.weather[0].description}
              </Text>

              {/* تفاصيل */}
              <View style={styles.detailsContainer}>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>💨 الرياح</Text>
                  <Text style={styles.detailValue}>
                    {weather.wind.speed} م/ث
                  </Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>💧 الرطوبة</Text>
                  <Text style={styles.detailValue}>
                    {weather.main.humidity}%
                  </Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>☁️ الغيوم</Text>
                  <Text style={styles.detailValue}>{weather.clouds.all}%</Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>🌡️ الإحساس</Text>
                  <Text style={styles.detailValue}>
                    {Math.round(weather.main.feels_like)}°C
                  </Text>
                </View>
              </View>

              {/* توقع 5 أيام */}
              {forecast.length > 0 && (
                <>
                  <Text
                    style={[styles.cityName, { fontSize: 24, marginTop: 10 }]}
                  >
                    توقعات ل5 أيام القادمة
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                    }}
                  >
                    {forecast.map((f, idx) => {
                      const d = new Date(f.dt * 1000);
                      const dayLabel = d.toLocaleDateString("ar-EG", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      });
                      return (
                        <View key={idx} style={styles.forecastCard}>
                          <Text style={styles.forecastDay}>{dayLabel}</Text>
                          <Image
                            source={{
                              uri: `https://openweathermap.org/img/wn/${f.weather[0].icon}@2x.png`,
                            }}
                            style={{ width: 60, height: 60, marginVertical: 4 }}
                          />
                          <Text style={styles.forecastTemp}>
                            {Math.round(f.main.temp)}°
                          </Text>
                          <Text style={styles.forecastDesc} numberOfLines={1}>
                            {f.weather[0].description}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
      <Text style={styles.watermark}>تمت برمجته بواسطة إسلام هدايا</Text>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: "cover" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    paddingTop: 60,
  },
  searchInput: {
    width: "85%",
    height: 45,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 15,
    color: "#fff",
    fontSize: 16,
    marginBottom: 25,
  },
  cityName: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  date: { fontSize: 16, color: "#ddd", marginBottom: 20 },
  weatherIcon: { width: 100, height: 100, marginBottom: 10 },
  temp: { fontSize: 48, fontWeight: "bold", color: "#facc15" },
  description: { fontSize: 20, color: "#fff", marginBottom: 20 },
  detailsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
  },
  detailBox: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: 10,
    margin: 5,
    width: 140,
    alignItems: "center",
  },
  detailLabel: { fontSize: 16, color: "#fff", marginBottom: 5 },
  detailValue: { fontSize: 18, fontWeight: "bold", color: "#fff" },

  forecastCard: {
    width: 110,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 6,
  },
  forecastDay: { color: "#fff", fontSize: 14 },
  forecastTemp: { color: "#facc15", fontSize: 22, fontWeight: "bold" },
  forecastDesc: { color: "#fff", fontSize: 12, textAlign: "center" },
  watermark: {
    position: "absolute",
    bottom: 10,
    right: 18,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)", // أبيض شفاف
    fontStyle: "italic",
  },
});
