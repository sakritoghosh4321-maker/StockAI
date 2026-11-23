import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
} from "recharts";

export default function SentimentHistoryChart({
  selected,
  history = [],
  loading,
  error,
  onRefresh,
}) {
    const chartData = [...history]
    .sort(
      (a, b) =>
        new Date(a.analyzed_at).getTime() -
        new Date(b.analyzed_at).getTime()
    )
    .map((item) => ({
      ...item,
      score: Number(item.average_score),
      date: new Date(item.analyzed_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  const latest = chartData[chartData.length - 1];
  const previous =
    chartData.length >= 2 ? chartData[chartData.length - 2] : null;

  const scoreChange = previous
    ? latest.score - previous.score
    : null;

  const recentScores = chartData.slice(-3).map((item) => item.score);
  const recentAverage = recentScores.length
    ? recentScores.reduce((total, score) => total + score, 0) /
      recentScores.length
    : null;

  const recentTrend =
    recentScores.length < 2
      ? "Insufficient data"
      : recentScores[recentScores.length - 1] -
          recentScores[0] > 0.05
        ? "Improving"
        : recentScores[recentScores.length - 1] -
            recentScores[0] < -0.05
          ? "Declining"
          : "Stable";

  const recentTrendColor =
    recentTrend === "Improving"
      ? "#34d399"
      : recentTrend === "Declining"
        ? "#fb7185"
        : "#94a3b8";

  const snapshotStatus =
    chartData.length <= 1
      ? "Initial data"
      : chartData.length < 5
        ? "Early trend"
        : "Trend developing";

  const snapshotStatusColor =
    chartData.length >= 5
      ? "#34d399"
      : chartData.length >= 2
        ? "#fbbf24"
        : "#94a3b8";

  const getScoreColor = (score) => {
    if (score > 0.15) return "#34d399";
    if (score < -0.15) return "#fb7185";
    return "#94a3b8";
  };

  const formatScore = (score) => {
    if (!Number.isFinite(score)) return "—";
    return `${score > 0 ? "+" : ""}${score.toFixed(2)}`;
  };

  const summaryCardStyle = {
    flex: "1 1 145px",
    minWidth: 0,
    padding: "14px",
    borderRadius: 9,
    background: "#0d1728",
    border: "1px solid #263a52",
  };

  const summaryLabelStyle = {
    display: "block",
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 8,
  };

  const summaryValueStyle = {
    fontSize: 23,
    fontWeight: 700,
    lineHeight: 1.3,
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <section
      className="sentiment-history-panel"
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 12,
        background: "#111f33",
        border: "1px solid #263a52",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Historical Sentiment Trend</h3>
          <p className="data-status" style={{ margin: "5px 0 0" }}>
            {selected} · Saved analysis snapshots · Score range: -1 to +1
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span className="data-status">
            {history.length} snapshots
          </span>
          <span
            style={{
              padding: "5px 9px",
              borderRadius: 20,
              border: `1px solid ${snapshotStatusColor}55`,
              background: `${snapshotStatusColor}12`,
              color: snapshotStatusColor,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {snapshotStatus}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 7,
              border: "1px solid #3b536e",
              background: "#172b43",
              color: "#e2e8f0",
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Refreshing..." : "↻ Refresh History"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="data-status">Loading sentiment history...</p>
      ) : error ? (
        <p style={{ color: "#fb7185" }}>{error}</p>
      ) : history.length === 0 ? (
        <p className="data-status">
          No historical snapshots are available yet. Analyze sentiment to
          save the first snapshot for {selected}.
        </p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Latest Score</span>
              <strong
                style={{
                  ...summaryValueStyle,
                  color: getScoreColor(latest.score),
                }}
              >
                {formatScore(latest.score)}
              </strong>
              <p
                style={{
                  margin: "6px 0 0",
                  color: getScoreColor(latest.score),
                  fontSize: 12,
                }}
              >
                {latest.overall_sentiment}
              </p>
            </div>

            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Previous Score</span>
              <strong
                style={{
                  ...summaryValueStyle,
                  color: previous
                    ? getScoreColor(previous.score)
                    : "#94a3b8",
                }}
              >
                {previous ? formatScore(previous.score) : "—"}
              </strong>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#94a3b8",
                  fontSize: 12,
                }}
              >
                {previous
                  ? previous.overall_sentiment
                  : "Need another analysis"}
              </p>
            </div>

            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Score Change</span>
              <strong
                style={{
                  ...summaryValueStyle,
                  color:
                    scoreChange === null
                      ? "#94a3b8"
                      : scoreChange > 0
                        ? "#34d399"
                        : scoreChange < 0
                          ? "#fb7185"
                          : "#94a3b8",
                }}
              >
                {scoreChange === null ? "—" : formatScore(scoreChange)}
              </strong>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#94a3b8",
                  fontSize: 12,
                }}
              >
                {scoreChange === null
                  ? "Not enough snapshots"
                  : scoreChange > 0
                    ? "Sentiment improved"
                    : scoreChange < 0
                      ? "Sentiment weakened"
                      : "No change"}
              </p>
            </div>

            <div style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Recent Trend</span>
              <strong
                style={{
                  ...summaryValueStyle,
                  color: recentTrendColor,
                }}
              >
                {recentTrend}
              </strong>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#94a3b8",
                  fontSize: 12,
                }}
              >
                {`Average: ${formatScore(recentAverage)} · Latest ${recentScores.length} snapshot${recentScores.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 18, left: 0, bottom: 8 }}
              >
                <CartesianGrid stroke="#263a52" strokeDasharray="3 3" />

                <ReferenceArea
                  y1={0.15}
                  y2={1}
                  fill="#34d399"
                  fillOpacity={0.07}
                />
                <ReferenceArea
                  y1={-0.15}
                  y2={0.15}
                  fill="#94a3b8"
                  fillOpacity={0.06}
                />
                <ReferenceArea
                  y1={-1}
                  y2={-0.15}
                  fill="#fb7185"
                  fillOpacity={0.07}
                />

                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "#475569" }}
                  angle={-20}
                  textAnchor="end"
                  height={55}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis
                  domain={[-1, 1]}
                  ticks={[-1, -0.5, 0, 0.5, 1]}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <ReferenceLine
                  y={0.15}
                  stroke="#34d399"
                  strokeWidth={1}
                  strokeDasharray="3 5"
                  label={{
                    value: "Positive threshold (+0.15)",
                    fill: "#34d399",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
                <ReferenceLine
                  y={-0.15}
                  stroke="#fb7185"
                  strokeWidth={1}
                  strokeDasharray="3 5"
                  label={{
                    value: "Negative threshold (-0.15)",
                    fill: "#fb7185",
                    fontSize: 10,
                    position: "insideBottomRight",
                  }}
                />
                <ReferenceLine
                  y={0}
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  label={{
                    value: "Neutral",
                    fill: "#94a3b8",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
                <Tooltip
                  cursor={{ stroke: "#64748b", strokeDasharray: "4 4" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;

                    const item = payload[0].payload;
                    const sentimentColor = getScoreColor(item.score);

                    const analysisDate = new Date(item.analyzed_at);
                    const formattedDate = Number.isNaN(analysisDate.getTime())
                      ? "Unknown date"
                      : analysisDate.toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        });

                    return (
                      <div
                        style={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: 10,
                          padding: "12px 14px",
                          color: "#e2e8f0",
                          minWidth: 190,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            marginBottom: 8,
                            color: "#cbd5e1",
                            fontSize: 12,
                          }}
                        >
                          {formattedDate}
                        </strong>

                        <div
                          style={{
                            color: sentimentColor,
                            fontWeight: 700,
                            marginBottom: 10,
                          }}
                        >
                          {item.overall_sentiment} Sentiment
                        </div>

                        <div style={{ fontSize: 12, lineHeight: 1.9 }}>
                          <div>
                            Average score: <strong>{formatScore(item.score)}</strong>
                          </div>
                          <div>
                            Total headlines: <strong>{item.total_news}</strong>
                          </div>
                          <div style={{ color: "#34d399" }}>
                            Positive: <strong>{item.positive_count}</strong>
                          </div>
                          <div style={{ color: "#94a3b8" }}>
                            Neutral: <strong>{item.neutral_count}</strong>
                          </div>
                          <div style={{ color: "#fb7185" }}>
                            Negative: <strong>{item.negative_count}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Average sentiment score"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const sentiment = props.payload?.overall_sentiment;
                    const pointColor =
                      sentiment === "Positive"
                        ? "#34d399"
                        : sentiment === "Negative"
                          ? "#fb7185"
                          : "#94a3b8";

                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill={pointColor}
                        stroke="#0f172a"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 7 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px 20px",
              marginTop: 14,
              marginBottom: 8,
            }}
          >
            {[
              { label: "Positive", range: "Above +0.15", color: "#34d399" },
              { label: "Neutral", range: "-0.15 to +0.15", color: "#94a3b8" },
              { label: "Negative", range: "Below -0.15", color: "#fb7185" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: item.color,
                    flexShrink: 0,
                  }}
                />
                <strong style={{ color: item.color }}>{item.label}</strong>
                <span style={{ color: "#94a3b8" }}>{item.range}</span>
              </div>
            ))}
          </div>

          <p className="data-status" style={{ marginTop: 10 }}>
            Each point represents one saved analysis. Repeated analyses create
            additional points; this is not a daily market-price chart.
          </p>
        </>
      )}
    </section>
  );
}
