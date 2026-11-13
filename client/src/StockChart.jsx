
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import "./StockChart.css";

const ranges = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
];

export default function StockChart({ symbol = "BEL" }) {
  const [range, setRange] = useState("1mo");
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataStatus, setDataStatus] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setLoading(true);
      setError("");
      setPrices([]);
      setDataStatus("");

      try {
        const response = await fetch(
          `http://localhost:5000/api/history/${encodeURIComponent(symbol)}?range=${range}`,
          { signal: controller.signal }
        );

        const result = await response.json();

        if (!response.ok || result.status !== "success") {
          throw new Error(
            result.message || "Historical prices are unavailable."
          );
        }

        if (!Array.isArray(result.prices) || result.prices.length === 0) {
          throw new Error("No historical price data was returned.");
        }

        const validPrices = result.prices
          .filter(
            (item) =>
              item.date &&
              Number.isFinite(Number(item.close)) &&
              Number(item.close) > 0
          )
          .map((item) => ({
            ...item,
            close: Number(item.close),
            date: String(item.date),
          }));

        if (validPrices.length === 0) {
          throw new Error("No valid closing prices were returned.");
        }

        setPrices(validPrices);
        setDataStatus(result.dataStatus || "PROVIDER DATA");
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to load historical prices.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => controller.abort();
  }, [symbol, range]);

  const chartData = useMemo(() => {
    return prices.map((item, index) => {
      const recentPrices = prices
        .slice(Math.max(0, index - 4), index + 1)
        .map((entry) => entry.close);

      const average =
        recentPrices.reduce((sum, price) => sum + price, 0) /
        recentPrices.length;

      return {
        ...item,
        price: item.close,
        average: Number(average.toFixed(2)),
      };
    });
  }, [prices]);

  const firstPrice = chartData[0]?.price ?? 0;
  const lastPrice = chartData[chartData.length - 1]?.price ?? 0;
  const change = lastPrice - firstPrice;
  const changePercent = firstPrice
    ? (change / firstPrice) * 100
    : 0;

  return (
    <section className="stock-chart-panel">
      <div className="stock-chart-header">
        <div>
          <h3>{symbol} Historical Price Chart</h3>
          <p className="stock-chart-note">
            {loading
              ? "Loading historical prices..."
              : dataStatus
                ? `${dataStatus} · Historical daily prices · INR`
                : "Historical market data"}
          </p>
        </div>

        <div className="stock-chart-ranges">
          {ranges.map((item) => (
            <button
              key={item.value}
              type="button"
              className={
                range === item.value
                  ? "range-button active"
                  : "range-button"
              }
              onClick={() => setRange(item.value)}
              disabled={loading}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            color: "#dc2626",
            marginTop: 16,
            padding: 12,
            background: "rgba(220, 38, 38, 0.08)",
            borderRadius: 8,
          }}
        >
          <strong>Unable to load chart</strong>
          <p>{error}</p>
          <button
            type="button"
            className="range-button"
            onClick={() => setRange((current) => current)}
          >
            Retry
          </button>
        </div>
      )}

      {!error && !loading && chartData.length > 0 && (
        <>
          <div className="stock-chart-summary">
            <div>
              <span>Latest available close</span>
              <strong>
                ₹{lastPrice.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>

            <div>
              <span>Change over selected period</span>
              <strong
                className={
                  change >= 0 ? "chart-positive" : "chart-negative"
                }
              >
                {change >= 0 ? "+" : ""}
                ₹{change.toFixed(2)} ({changePercent.toFixed(2)}%)
              </strong>
            </div>
          </div>

          <div className="stock-chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  minTickGap={25}
                />

                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `₹${value}`}
                  width={75}
                />

                <Tooltip
                  formatter={(value, name) => [
                    `₹${Number(value).toFixed(2)}`,
                    name === "price" ? "Closing Price" : "5-Day Average",
                  ]}
                />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="price"
                  name="Closing Price"
                  stroke="#4f8cff"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls
                />

                <Line
                  type="monotone"
                  dataKey="average"
                  name="5-Day Average"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 4"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="stock-chart-note">
            Historical prices are provided by an unofficial data source and
            may be delayed or unavailable. The 5-day average is calculated
            from the available closing prices. This chart is for information
            only and is not investment advice.
          </p>
        </>
      )}

      {loading && (
        <p className="stock-chart-note" style={{ marginTop: 24 }}>
          Fetching historical stock prices...
        </p>
      )}
    </section>
  );
}
