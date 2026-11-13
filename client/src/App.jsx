
import { Fragment, lazy, Suspense, useEffect, useState } from "react";
import "./App.css";
const StockChart = lazy(() => import("./StockChart"));

const API = "http://localhost:5000";

async function copyIdentifier(value, setCopiedIdentifier) {
  if (!value) return;

  try {
    await navigator.clipboard.writeText(String(value));
    setCopiedIdentifier(String(value));
    window.setTimeout(() => setCopiedIdentifier(""), 2000);
  } catch (error) {
    window.alert("Unable to copy. Please copy the identifier manually.");
  }
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") {
    return "Unavailable";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return "Unavailable";

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value.toLocaleString("en-IN", { maximumFractionDigits: 4 })
      : "Not available";
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (Array.isArray(value)) return value.map(formatValue).join(", ");

  if (typeof value === "object") return JSON.stringify(value);

  return String(value);
}

function Change({ value, percent }) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return <span className="data-status">Change unavailable</span>;
  }

  const positive = Number(value) >= 0;

  return (
    <span style={{
      color: positive ? "#34d399" : "#fb7185",
      fontWeight: 700,
    }}>
      {positive ? "+" : ""}
      {formatPrice(value)}
      {percent !== null && percent !== undefined
        ? ` (${Number(percent) > 0 ? "+" : ""}${percent}%)`
        : ""}
    </span>
  );
}

function Metric({ label, value, color }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong style={{ color: color || "#f8fafc", fontSize: 22 }}>
        {formatValue(value)}
      </strong>
    </article>
  );
}

function DataStatus({ data }) {
  const status = data?.dataStatus || data?.source || "";

  if (!status) return null;

  const demo = /demo|mock|sample|simulated/i.test(String(status));

  return (
    <span
      className="data-status"
      style={{
        display: "inline-block",
        marginBottom: 14,
        color: demo ? "#fbbf24" : "#94a3b8",
      }}
    >
      Data status: {status}
    </span>
  );
}

function DataRows({ data }) {
  if (data === null || data === undefined) {
    return <p className="data-status">Waiting for data...</p>;
  }

  if (typeof data !== "object") {
    return <p>{formatValue(data)}</p>;
  }

  if (Array.isArray(data)) {
    if (!data.length) return <p className="data-status">No data available.</p>;

    return (
      <div style={{ display: "grid", gap: 10 }}>
        {data.map((item, index) => (
          <div
            key={index}
            style={{
              padding: 12,
              border: "1px solid #263a52",
              borderRadius: 10,
              overflowWrap: "anywhere",
            }}
          >
            {typeof item === "object" && item !== null
              ? <DataRows data={item} />
              : formatValue(item)}
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(data).filter(
    ([key]) => !["status", "dataStatus"].includes(key)
  );

  if (!entries.length) {
    return <p className="data-status">No details returned.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {entries.map(([key, value]) => {
        const nested = value !== null && typeof value === "object";

        return (
          <div
            key={key}
            style={{
              padding: 12,
              border: "1px solid #263a52",
              borderRadius: 10,
              background: "#111f33",
              minWidth: 0,
            }}
          >
            <div
              style={{
                color: "#94a3b8",
                fontSize: 12,
                marginBottom: 6,
                textTransform: "capitalize",
                overflowWrap: "anywhere",
              }}
            >
              {key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}
            </div>

            {nested
              ? <DataRows data={value} />
              : <strong style={{ overflowWrap: "anywhere" }}>
                  {formatValue(value)}
                </strong>}
          </div>
        );
      })}
    </div>
  );
}

function CompanySourceLinks({ symbol }) {
  const sources = {
    BEL: [
      { label: "BEL Official Website", url: "https://bel-india.in/" },
      { label: "BEL Investor Information", url: "https://bel-india.in/investors/" },
    ],
    TCS: [
      { label: "TCS Official Website", url: "https://www.tcs.com/" },
      { label: "TCS Newsroom", url: "https://www.tcs.com/who-we-are/newsroom" },
      { label: "TCS Investor Relations", url: "https://www.tcs.com/investor-relations" },
    ],
    RELIANCE: [
      { label: "Reliance Industries", url: "https://www.ril.com/" },
      { label: "Reliance Investor Relations", url: "https://www.ril.com/investors" },
    ],
    TATAMOTORS: [
      { label: "Tata Motors Official Website", url: "https://www.tatamotors.com/" },
      { label: "Tata Motors Investors", url: "https://www.tatamotors.com/investors/" },
    ],
    ADANIPOWER: [
      { label: "Adani Power Official Website", url: "https://www.adanipower.com/" },
      { label: "Adani Power Investors", url: "https://www.adanipower.com/investors" },
    ],
    SBIN: [
      { label: "SBI Official Website", url: "https://sbi.co.in/" },
      { label: "SBI Investor Relations", url: "https://sbi.co.in/web/investor-relations" },
    ],
  };

  const links = sources[String(symbol || "").toUpperCase()] || [];

  return (
    <div style={{ marginTop: 18 }}>
      <h3>Official Company Sources</h3>
      <p style={{ color: "#fbbf24", lineHeight: 1.6 }}>
        These links are starting points for checking company information.
        Database descriptions below are not independently verified current
        announcements. Verify the announcement date and details on the source
        website before relying on an order or contract claim.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#67e8f9", textDecoration: "underline" }}
          >
            {link.label}
          </a>
        ))}
      </div>
      {links.length === 0 && (
        <p className="data-status">No official links configured for this company yet.</p>
      )}
    </div>
  );
}


function DataPanel({ title, data, kind }) {
  const [expanded, setExpanded] = useState(false);

  if (!data) {
    return (
      <section className="section">
        <h2>{title}</h2>
        <div className="loading-card">Loading {title.toLowerCase()}...</div>
      </section>
    );
  }

  if (data.error) {
    return (
      <section className="section">
        <h2>{title}</h2>
        <p className="data-status" style={{ color: "#fbbf24" }}>
          This section could not load: {data.error}
        </p>
      </section>
    );
  }

  const contentKey = {
    technical: "technicalAnalysis",
    prediction: "prediction",
    profile: "company",
    intelligence: "intelligence",
    financial: "financialAnalysis",
    risk: "riskAnalysis",
  }[kind];

  const content = contentKey && data[contentKey]
    ? data[contentKey]
    : data;

  const isDemo = /demo|mock|sample|simulated/i.test(
    `${data.dataStatus || ""} ${content.model || ""}`
  );

  const technical = kind === "technical" ? content : null;
  const prediction = kind === "prediction" ? content : null;
  const indicators = technical?.indicators || {};
  const modelMetrics = prediction?.modelMetrics || {};

  return (
    <section className="section">
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <h2>{title}</h2>

        {isDemo && (
          <span className="data-status" style={{ color: "#fbbf24" }}>
            DEMO DATA
          </span>
        )}
      </div>

      <DataStatus data={data} />

      {technical && (
        <>
          <div className="stats-grid">
            <Metric
              label="Trend"
              value={technical.trend}
              color={/bullish/i.test(String(technical.trend))
                ? "#34d399" : "#f8fafc"}
            />
            <Metric label="Model signal" value={technical.signal} />
            <Metric label="Volatility" value={technical.volatility} />
            <Metric label="RSI" value={indicators.rsi} />
          </div>

          <h3 style={{ marginTop: 24 }}>Moving Averages</h3>
          <div className="stats-grid">
            <Metric label="SMA 20" value={indicators.sma20} />
            <Metric label="SMA 50" value={indicators.sma50} />
            <Metric label="SMA 200" value={indicators.sma200} />
            <Metric label="EMA 20" value={indicators.ema20} />
          </div>

          <h3 style={{ marginTop: 24 }}>Momentum and Volatility</h3>
          <div className="stats-grid">
            <Metric label="MACD" value={indicators.macd} />
            <Metric label="MACD Signal" value={indicators.macdSignal} />
            <Metric label="Bollinger Upper" value={indicators.bollingerUpper} />
            <Metric label="Bollinger Middle" value={indicators.bollingerMiddle} />
            <Metric label="Bollinger Lower" value={indicators.bollingerLower} />
          </div>

          <h3 style={{ marginTop: 24 }}>Support and Resistance</h3>
          <div className="stats-grid">
            <Metric
              label="Support levels"
              value={technical.support}
              color="#34d399"
            />
            <Metric
              label="Resistance levels"
              value={technical.resistance}
              color="#fb7185"
            />
          </div>
        </>
      )}

      {prediction && (
        <>
          <p style={{ color: "#fbbf24", lineHeight: 1.7 }}>
            Prediction outputs may be demonstrations rather than validated
            forecasts. They are not guaranteed future prices or investment advice.
          </p>

          <div className="stats-grid">
            <Metric label="Current model price" value={prediction.currentPrice} />
            <Metric label="Predicted model price" value={prediction.predictedPrice} />
            <Metric
              label="Expected model change"
              value={prediction.expectedChange == null
                ? "Not available"
                : `${prediction.expectedChange}%`}
              color={Number(prediction.expectedChange) >= 0
                ? "#34d399" : "#fb7185"}
            />
            <Metric label="Model direction" value={prediction.direction} />
            <Metric
              label="Model confidence"
              value={prediction.confidence == null
                ? "Not available"
                : `${prediction.confidence}%`}
            />
            <Metric label="Forecast period" value={prediction.forecastPeriod} />
          </div>

          <h3 style={{ marginTop: 24 }}>Model Information</h3>
          <DataRows data={{
            model: prediction.model,
            MAE: modelMetrics.mae,
            RMSE: modelMetrics.rmse,
            MAPE: modelMetrics.mape,
          }} />

          {prediction.factors && (
            <>
              <h3 style={{ marginTop: 24 }}>Model Factors</h3>
              <DataRows data={prediction.factors} />
            </>
          )}
        </>
      )}

      {kind === "intelligence" && (
        <CompanySourceLinks symbol={content.symbol} />
      )}

            {kind === "risk" && (
  <>
    <p style={{ color: "#fbbf24", lineHeight: 1.7 }}>
      Risk metrics describe historical price behaviour, not guaranteed future performance.
    </p>
    <div className="stats-grid">
      <Metric label="Overall Risk Score" value={content.overallRiskScore} />
      <Metric label="Risk Level" value={content.riskLevel} />
      <Metric label="Annualized Volatility" value={content.annualizedHistoricalVolatility == null ? "Not available" : `${content.annualizedHistoricalVolatility}%`} />
      <Metric label="Annualized Downside Risk" value={content.annualizedDownsideRisk == null ? "Not available" : `${content.annualizedDownsideRisk}%`} />
      <Metric label="Maximum Drawdown" value={content.maximumDrawdown == null ? "Not available" : `${content.maximumDrawdown}%`} />
      <Metric label="Volatility Risk" value={content.volatilityRisk} />
      <Metric label="Current Price" value={content.currentPrice} />
      <Metric label="50-Session Average" value={content.average50Session} />
      <Metric label="Historical Observations" value={content.historicalObservations} />
      <Metric label="Downside Observations" value={content.downsideObservationCount} />
    </div>
    <h3 style={{ marginTop: 24 }}>Assessment Period</h3>
    <p>{content.assessmentPeriod || "Not available"}</p>
    <h3 style={{ marginTop: 24 }}>Data Quality</h3>
    <DataRows data={{
      "Quality Status": content.dataQuality?.status,
      "Price Series Used": content.dataQuality?.priceSeriesUsed,
      "Maximum Gap (days)": content.dataQuality?.maximumGapDays,
      "Assessment Period (days)": content.dataQuality?.periodDays
    }} />
  </>
)}
{kind === "financial" && (
        <>
          <div style={{
  padding: 14,
  marginBottom: 18,
  borderRadius: 8,
  background: "rgba(251, 191, 36, 0.08)",
  border: "1px solid rgba(251, 191, 36, 0.25)",
  lineHeight: 1.7
}}>
  <strong style={{ color: "#fbbf24" }}>
    Financial Statements & Verification
  </strong>

  {(() => {
    const records = data.fundamentals?.fundamentals || [];

    if (records.length === 0) {
      return (
        <p style={{ marginBottom: 0 }}>
          No verified financial-statement records are available for this
          company yet. Figures will appear here after verified records
          are added to the StockAI database.
        </p>
      );
    }

    return records.map((record, index) => (
      <div
        key={`${record.periodEnd || "period"}-${index}`}
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 6,
          background: "rgba(15, 23, 42, 0.65)"
        }}
      >
        <h4 style={{ marginTop: 0 }}>
          {record.periodType || "Financial Period"} {"\u2014"} {
            record.periodEnd && !Number.isNaN(Date.parse(record.periodEnd))
              ? new Date(record.periodEnd).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC"
                })
              : "Date unavailable"
          }
        </h4>

        <span style={{
          display: "inline-block",
          marginBottom: 12,
          padding: "5px 10px",
          borderRadius: 5,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          color: String(record.verificationStatus).toUpperCase() === "VERIFIED" ? "#86efac" : "#fbbf24",
          background: String(record.verificationStatus).toUpperCase() === "VERIFIED" ? "rgba(34,197,94,0.12)" : "rgba(251,191,36,0.12)",
          border: String(record.verificationStatus).toUpperCase() === "VERIFIED" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(251,191,36,0.3)"
        }}>
          {String(record.verificationStatus || "UNKNOWN").toUpperCase() === "PENDING"
            ? "PENDING VERIFICATION"
            : String(record.verificationStatus || "UNKNOWN").toUpperCase()}
        </span>

        <DataRows data={{
          "Reporting Basis": record.reportingBasis === "CONSOLIDATED"
            ? "Consolidated"
            : record.reportingBasis === "STANDALONE"
              ? "Standalone"
              : record.reportingBasis || "Not specified",
          "Amount Unit": record.amountUnit === "INR_CRORE" ? "\u20B9 crore" : record.amountUnit === "INR_LAKH" ? "\u20B9 lakh" : record.amountUnit === "INR" ? "\u20B9 (rupees)" : record.amountUnit || "Not specified",
          "Currency": record.currency,
          [`Revenue (${record.amountUnit === "INR_CRORE" ? "\u20B9 crore" : record.amountUnit === "INR_LAKH" ? "\u20B9 lakh" : record.amountUnit === "INR" ? "\u20B9" : record.amountUnit || "reported units"})`]: record.revenue,
          [`Net Profit (${record.amountUnit === "INR_CRORE" ? "\u20B9 crore" : record.amountUnit === "INR_LAKH" ? "\u20B9 lakh" : record.amountUnit === "INR" ? "\u20B9" : record.amountUnit || "reported units"})`]: record.netProfit,
          "Earnings Per Share (\u20B9/share)": record.eps,
          [`Total Assets (${record.amountUnit === "INR_CRORE" ? "\u20B9 crore" : record.amountUnit === "INR_LAKH" ? "\u20B9 lakh" : record.amountUnit === "INR" ? "\u20B9" : record.amountUnit || "reported units"})`]: record.totalAssets,
          [`Total Debt (${record.amountUnit === "INR_CRORE" ? "\u20B9 crore" : record.amountUnit === "INR_LAKH" ? "\u20B9 lakh" : record.amountUnit === "INR" ? "\u20B9" : record.amountUnit || "reported units"})`]: record.totalDebt,
          [`Shareholders' Equity (${record.amountUnit === "INR_CRORE" ? "\u20B9 crore" : record.amountUnit === "INR_LAKH" ? "\u20B9 lakh" : record.amountUnit === "INR" ? "\u20B9" : record.amountUnit || "reported units"})`]: record.shareholdersEquity,
          [`Operating Cash Flow (${record.amountUnit === "INR_CRORE" ? "\u20B9 crore" : record.amountUnit === "INR_LAKH" ? "\u20B9 lakh" : record.amountUnit === "INR" ? "\u20B9" : record.amountUnit || "reported units"})`]: record.operatingCashFlow,
          "Data Source": record.sourceName,
          "Verification Status": record.verificationStatus
        }} />
        {record.sourceUrl && (
          <p>
            <a
              href={record.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              View Source
            </a>
          </p>
        )}
      </div>
    ));
  })()}


  {(() => {
    const yoy = data.fundamentals?.yearOverYear;
    if (!yoy) return null;

    const labels = {
      revenue: "Revenue Growth",
      netProfit: "Net Profit Growth",
      eps: "EPS Growth",
      totalAssets: "Total Assets Growth",
      totalDebt: "Total Debt Growth",
      shareholdersEquity: "Shareholders' Equity Growth",
      operatingCashFlow: "Operating Cash Flow Growth"
    };

    const metrics = {};

    Object.entries(labels).forEach(([field, label]) => {
      const result = yoy.metrics?.[field];

      if (!result) {
        metrics[label] = "Not available";
      } else if (result.growthPercentage != null) {
        const value = Number(result.growthPercentage);
        metrics[label] = `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
      } else if (result.reason === "PREVIOUS_VALUE_NOT_POSITIVE") {
        metrics[label] = "Not meaningful";
      } else if (result.reason === "FINANCIAL_VALUE_UNAVAILABLE") {
        metrics[label] = "Unavailable (financial value missing)";
      } else {
        metrics[label] = "Unavailable (reason not provided)";
      }
    });

    return (
      <div style={{
        marginTop: 18,
        marginBottom: 18,
        padding: 14,
        borderRadius: 8,
        background: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.25)"
      }}>
        <h4 style={{ marginTop: 0 }}>Year-over-Year (YoY) Growth</h4>

        <p style={{ fontSize: 13, color: "#94a3b8" }}>
          Current year: {yoy.currentPeriodEnd || "Unavailable"}
          {" | "}
          Previous year: {yoy.previousPeriodEnd || "Unavailable"}
        </p>

        {yoy.status === "PREVIOUS_YEAR_PENDING_VERIFICATION" ? (
          <p style={{ color: "#fbbf24" }}>
            Previous-year financial statements are pending verification.
            YoY growth will appear after verification.
          </p>
        ) : yoy.status === "CALCULATED_FROM_VERIFIED_RECORDS" ? (
          <>
            <p style={{ color: "#86efac" }}>
              Calculated using verified annual financial statements.
            </p>
            <DataRows data={metrics} />

            {yoy.epsAdjustment && (
              <div style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 8,
                background: "rgba(148, 163, 184, 0.08)",
                border: "1px solid rgba(148, 163, 184, 0.2)"
              }}>
                <h4 style={{ marginTop: 0, marginBottom: 10 }}>
                  EPS Adjustment Details
                </h4>

                <DataRows data={{
                  "Adjustment Status": yoy.epsAdjustment.status,
                  "Adjustment Factor": Number(
                    yoy.epsAdjustment.adjustmentFactor
                  ).toFixed(4),
                  "Reported Previous EPS": yoy.epsAdjustment.reportedPreviousEPS == null
                    ? "Unavailable"
                    : `₹${Number(yoy.epsAdjustment.reportedPreviousEPS).toFixed(2)}`,
                  "Adjusted Previous EPS": yoy.epsAdjustment.adjustedPreviousEPS == null
                    ? "Unavailable"
                    : `₹${Number(yoy.epsAdjustment.adjustedPreviousEPS).toFixed(2)}`
                }} />

                {yoy.epsAdjustment.status === "NO_VERIFIED_CORPORATE_ACTIONS" && (
                  <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 0 }}>
                    No verified bonus issue or stock split was applicable
                    between these financial periods. Reported previous EPS
                    is used without adjustment.
                  </p>
                )}

                {Array.isArray(yoy.epsAdjustment.actions) &&
                  yoy.epsAdjustment.actions.map((action, index) => (
                    <div
                      key={`${action.sourceName || "action"}-${index}`}
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: "1px solid rgba(148, 163, 184, 0.2)"
                      }}
                    >
                      <p style={{ margin: "0 0 6px" }}>
                        <strong>{action.actionType || "Corporate action"}</strong>
                        {" — "}
                        Ratio: {action.ratioNumerator}:{action.ratioDenominator}
                      </p>
                      <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0" }}>
                        Effective date: {action.effectiveDate || "Unavailable"}
                        {" | "}
                        Verification: {action.verificationStatus || "VERIFIED"}
                      </p>
                      <p style={{ fontSize: 13, margin: "4px 0" }}>
                        Source: {action.sourceName || "Unavailable"}
                      </p>
                      {action.sourceUrl && (
                        <a href={action.sourceUrl} target="_blank" rel="noreferrer">
                          View corporate action source
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ color: "#fbbf24" }}>
            YoY growth is unavailable because the required previous-year
            verified financial record is not available.
          </p>
        )}
      </div>
    );
  })()}

<p style={{ marginBottom: 0, marginTop: 14, fontSize: 13 }}>
    Historical market metrics describe past price behaviour, not future returns.
  </p>
</div>

          <h3 style={{ marginTop: 20 }}>Market Performance</h3>
          <div className="stats-grid">
            <Metric label="Current Price" value={content.currentPrice} />
            <Metric label="Previous Close" value={content.previousClose} />
            <Metric
              label="Daily Change"
              value={content.dailyChangePercent == null
                ? "Not available"
                : `${content.dailyChangePercent}%`}
              color={Number(content.dailyChangePercent) >= 0
                ? "#34d399"
                : "#fb7185"}
            />
            <Metric label="20-Session Average" value={content.average20Session} />
            <Metric label="50-Session Average" value={content.average50Session} />
            <Metric label="Market Trend" value={content.marketTrend} />
          </div>

          <h3 style={{ marginTop: 24 }}>Historical Risk Metrics</h3>
          <div className="stats-grid">
            <Metric
              label="Annualized Historical Volatility"
              value={content.annualizedHistoricalVolatility == null
                ? "Not available"
                : `${content.annualizedHistoricalVolatility}%`}
            />
            <Metric
              label="Maximum Historical Drawdown"
              value={content.maximumDrawdown == null
                ? "Not available"
                : `${content.maximumDrawdown}%`}
            />
            <Metric
              label="Historical Observations"
              value={content.historicalObservations}
            />
          </div>

          <h3 style={{ marginTop: 24 }}>Company Fundamentals</h3>
          <DataRows data={{
            "Market Capitalization": content.marketCap,
            Revenue: content.revenue,
            "Revenue Growth": content.revenueGrowth,
            "Net Profit": content.netProfit,
            "Profit Growth": content.profitGrowth,
            EPS: content.eps,
            "PE Ratio": content.peRatio,
            ROE: content.roe,
            ROCE: content.roce,
            "Debt to Equity": content.debtToEquity,
            "Profit Margin": content.profitMargin,
            "Dividend Yield": content.dividendYield,
            "Book Value": content.bookValue,
            "Financial Health": content.financialHealth,
            "Growth Outlook": content.growthOutlook,
          }} />

          {data.verifiedFundamentals && (
            <>
              <h3 style={{ marginTop: 24 }}>Verified Financial Statement</h3>
              <DataRows data={{
                "Verification Status": data.verifiedFundamentals.verificationStatus,
                "Reporting Period": data.verifiedFundamentals.periodEnd
                  ? new Date(data.verifiedFundamentals.periodEnd).toLocaleDateString("en-IN")
                  : "Not available",
                "Period Type": data.verifiedFundamentals.periodType,
                "Reporting Basis": data.verifiedFundamentals.reportingBasis,
                "Currency": data.verifiedFundamentals.currency,
                "Amount Unit": data.verifiedFundamentals.amountUnit,
                "Source": data.verifiedFundamentals.sourceName,
              }} />
              {data.verifiedFundamentals.sourceUrl && (
                <p style={{ marginTop: 12 }}>
                  <a
                    href={data.verifiedFundamentals.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#60a5fa" }}
                  >
                    View Original Financial Filing ↗
                  </a>
                </p>
              )}
            </>
          )}
        </>
      )}
{kind !== "technical" &&
  kind !== "prediction" &&
  kind !== "financial" &&
  kind !== "risk" && (
    <DataRows data={content} />
  )}


      <button
        type="button"
        className="primary-button"
        style={{ marginTop: 18, border: 0, cursor: "pointer" }}
        onClick={() => setExpanded((previous) => !previous)}
      >
        {expanded ? "Hide raw API response" : "View raw API response"}
      </button>

      {expanded && (
        <pre
          className="loading-card"
          style={{
            marginTop: 14,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: 500,
            overflow: "auto",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  );
}

export default function App() {
  const [market, setMarket] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selected, setSelected] = useState("BEL");
  const [selectedExchange, setSelectedExchange] = useState("NSE");
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState({});
  const [news, setNews] = useState(null);
  const [companyNews, setCompanyNews] = useState(null);
  const [newsRefreshKey, setNewsRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sentiment, setSentiment] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState("");
  const [newsFilter, setNewsFilter] = useState("market");
  const [listingExchange, setListingExchange] = useState("NSE");
  const [listingSearch, setListingSearch] = useState("BEL");
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");
  const [listingsSearched, setListingsSearched] = useState(false);
  const [copiedIdentifier, setCopiedIdentifier] = useState("");
  const [corporateActions, setCorporateActions] = useState([]);
  const [corporateActionsSummary, setCorporateActionsSummary] = useState([]);
  const [corporateActionsLoading, setCorporateActionsLoading] = useState(false);
  const [corporateActionsError, setCorporateActionsError] = useState("");
  const [corporateActionsFilter, setCorporateActionsFilter] = useState("ALL");
  const [corporateActionsSearch, setCorporateActionsSearch] = useState("");
  const [corporateActionsTypeFilter, setCorporateActionsTypeFilter] = useState("ALL");
  const [corporateActionsSourceFilter, setCorporateActionsSourceFilter] = useState("ALL");
  const [corporateActionsFromDate, setCorporateActionsFromDate] = useState("");
  const [corporateActionsToDate, setCorporateActionsToDate] = useState("");
  const [corporateActionsSort, setCorporateActionsSort] = useState("EFFECTIVE_NEWEST");
  const [corporateActionsPage, setCorporateActionsPage] = useState(1);
  const [corporateActionsPageSize, setCorporateActionsPageSize] = useState(10);
  const [expandedCorporateActionIds, setExpandedCorporateActionIds] = useState([]);
  const [copiedCorporateActionId, setCopiedCorporateActionId] = useState(null);

  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem("stockai-admin-token") || "");
  const [adminUser, setAdminUser] = useState(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState("");
  const [adminReviewNotes, setAdminReviewNotes] = useState({});
  const [adminReviewBusyId, setAdminReviewBusyId] = useState(null);
  const [adminReviewError, setAdminReviewError] = useState("");
  const [adminReviewSuccess, setAdminReviewSuccess] = useState("");

  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("stockai-watchlist") || "[]");
    } catch {
      return [];
    }
  });

  const [portfolioSymbol, setPortfolioSymbol] = useState("BEL");
  const [buyPrice, setBuyPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    localStorage.setItem("stockai-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);


  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, options);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || `API error ${response.status}`);
    }

    return result;
  }

  useEffect(() => {
    const savedToken = sessionStorage.getItem("stockai-admin-token");
    if (!savedToken) return;

    let active = true;

    request("/api/auth/me", {
      headers: { Authorization: `Bearer ${savedToken}` }
    })
      .then((result) => {
        if (!active) return;

        if (result.user?.role !== "ADMIN") {
          throw new Error("Administrator access required.");
        }

        setAdminToken(savedToken);
        setAdminUser(result.user);
      })
      .catch(() => {
        if (!active) return;

        sessionStorage.removeItem("stockai-admin-token");
        setAdminToken("");
        setAdminUser(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const corporateActionCounts = {
    total: corporateActionsSummary.length,
    pending: corporateActionsSummary.filter(
      (action) => String(action.verificationStatus).toUpperCase() === "PENDING"
    ).length,
    verified: corporateActionsSummary.filter(
      (action) => String(action.verificationStatus).toUpperCase() === "VERIFIED"
    ).length,
    rejected: corporateActionsSummary.filter(
      (action) => String(action.verificationStatus).toUpperCase() === "REJECTED"
    ).length,
    bonusIssues: corporateActionsSummary.filter(
      (action) => String(action.actionType).toUpperCase() === "BONUS"
    ).length,
    stockSplits: corporateActionsSummary.filter(
      (action) => String(action.actionType).toUpperCase() === "STOCK_SPLIT"
    ).length,
  };
  const corporateActionVerificationProgress = corporateActionCounts.total > 0
    ? Number(((corporateActionCounts.verified / corporateActionCounts.total) * 100).toFixed(1))
    : 0;
  const corporateActionPendingProgress = corporateActionCounts.total > 0
    ? Number(((corporateActionCounts.pending / corporateActionCounts.total) * 100).toFixed(1))
    : 0;
  const corporateActionRejectedProgress = corporateActionCounts.total > 0
    ? Number(((corporateActionCounts.rejected / corporateActionCounts.total) * 100).toFixed(1))
    : 0;
  const corporateActionReviewedCount =
    corporateActionCounts.verified + corporateActionCounts.rejected;
  const corporateActionVerificationCoverage = corporateActionCounts.total > 0
    ? Number(((corporateActionReviewedCount / corporateActionCounts.total) * 100).toFixed(1))
    : 0;
  const corporateActionReviewStatus = corporateActionCounts.total === 0
    ? "No actions available"
    : corporateActionVerificationCoverage === 100
      ? "All actions reviewed"
      : corporateActionVerificationCoverage === 0
        ? "Review not started"
        : "Review in progress";
  const corporateActionsSourceCounts = corporateActions.reduce(
    (counts, action) => {
      const sourceLinks = String(action.sourceUrl || "").split(/\s+/).filter(Boolean);

      if (sourceLinks.length > 0) {
        counts.available++;
      } else {
        counts.missing++;
      }

      return counts;
    },
    { available: 0, missing: 0 }
  );
  const corporateActionsSourceCoverage = corporateActions.length > 0
    ? Number(((corporateActionsSourceCounts.available / corporateActions.length) * 100).toFixed(1))
    : 0;
  const filteredCorporateActions = corporateActions
    .filter((action) => {
      const matchesSymbol = String(action.symbol || "")
        .toLowerCase()
        .includes(corporateActionsSearch.trim().toLowerCase());

      const matchesType =
        corporateActionsTypeFilter === "ALL" ||
        String(action.actionType || "").toUpperCase() === corporateActionsTypeFilter;

      const effectiveDate = action.effectiveDate
        ? new Date(action.effectiveDate).toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata"
          })
        : "";

      const matchesFromDate =
        !corporateActionsFromDate ||
        (effectiveDate && effectiveDate >= corporateActionsFromDate);

      const matchesToDate =
        !corporateActionsToDate ||
        (effectiveDate && effectiveDate <= corporateActionsToDate);

      const sourceLinks = String(action.sourceUrl || "").split(/\s+/).filter(Boolean);
      const matchesSource =
        corporateActionsSourceFilter === "ALL" ||
        (corporateActionsSourceFilter === "AVAILABLE" && sourceLinks.length > 0) ||
        (corporateActionsSourceFilter === "MISSING" && sourceLinks.length === 0);

      return matchesSymbol && matchesType && matchesFromDate && matchesToDate && matchesSource;
    })
    .sort((a, b) => {
      const dateField = corporateActionsSort.startsWith("ANNOUNCEMENT")
        ? "announcementDate"
        : "effectiveDate";

      const dateA = new Date(a[dateField] || 0).getTime();
      const dateB = new Date(b[dateField] || 0).getTime();

      return corporateActionsSort.endsWith("OLDEST")
        ? dateA - dateB
        : dateB - dateA;
    });

  const filteredSourceLinkCount = filteredCorporateActions.filter(
    (action) => String(action.sourceUrl || "").split(/\s+/).filter(Boolean).length > 0
  ).length;

  const filteredSourceCoverage = filteredCorporateActions.length > 0
    ? Number(((filteredSourceLinkCount / filteredCorporateActions.length) * 100).toFixed(1))
    : 0;

  const corporateActionsTotalPages = Math.max(
    1,
    Math.ceil(filteredCorporateActions.length / corporateActionsPageSize)
  );

  const paginatedCorporateActions = filteredCorporateActions.slice(
    (corporateActionsPage - 1) * corporateActionsPageSize,
    corporateActionsPage * corporateActionsPageSize
  );

  useEffect(() => {
    setCorporateActionsPage((page) =>
      Math.min(page, corporateActionsTotalPages)
    );
  }, [corporateActionsTotalPages]);

  function exportCorporateActionsCsv() {
    const headers = [
      "Company",
      "Action Type",
      "Ratio",
      "Announcement Date",
      "Record Date",
      "Effective Date",
      "Status",
      "Source Name",
      "Source Link Count",
      "Source URL"
    ];

    const escapeCsv = (value) => {
      let text = String(value ?? "");
      if (/^[\s]*[=+\-@]/.test(text)) text = String.fromCharCode(39) + text;
      return String.fromCharCode(34) + text.replace(/"/g, String.fromCharCode(34, 34)) + String.fromCharCode(34);
    };

    const formatDate = (value) =>
      value
        ? new Date(value).toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata"
          })
        : "";

    const rows = filteredCorporateActions.map((action) => [
      action.symbol,
      action.actionType,
      `${action.ratioNumerator}:${action.ratioDenominator}`,
      formatDate(action.announcementDate),
      formatDate(action.recordDate),
      formatDate(action.effectiveDate),
      action.verificationStatus,
      action.sourceName,
      String(action.sourceUrl || "").split(/\s+/).filter(Boolean).length,
      action.sourceUrl
    ]);

    const exportTimestamp = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata"
    });

    const exportSummary = [
      ["Export Date", exportTimestamp],
      ["Total Exported Actions", filteredCorporateActions.length],
      ["Total Actions in Dataset", corporateActions.length],
      ["Actions with Source Links", corporateActionsSourceCounts.available],
      ["Overall Dataset Source Coverage", `${corporateActionsSourceCoverage}%`],
      ["Exported Actions with Source Links", filteredSourceLinkCount],
      ["Filtered Export Source Coverage", `${filteredSourceCoverage}%`],
      ["Verification Status", corporateActionsFilter],
      ["Action Type", corporateActionsTypeFilter],
      ["Source Availability", corporateActionsSourceFilter],
      ["Effective Date From", corporateActionsFromDate || "Any"],
      ["Effective Date To", corporateActionsToDate || "Any"],
      ["Sorted By", corporateActionsSort]
    ];

    const csv = [
      ...exportSummary.map((row) => row.map(escapeCsv).join(",")),
      "",
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const sortLabel = corporateActionsSort
      .replace("EFFECTIVE_", "effective-")
      .replace("ANNOUNCEMENT_", "announcement-")
      .toLowerCase();

    const dateSuffix = [
      corporateActionsFromDate ? `from-${corporateActionsFromDate}` : "",
      corporateActionsToDate ? `to-${corporateActionsToDate}` : ""
    ].filter(Boolean).join("-");

    const statusLabel = corporateActionsFilter.toLowerCase();
    const typeLabel = corporateActionsTypeFilter === "ALL"
      ? "all-types"
      : corporateActionsTypeFilter.toLowerCase().replace("_", "-");

    const sourceLabel = corporateActionsSourceFilter === "ALL"
      ? "all-sources"
      : corporateActionsSourceFilter.toLowerCase() + "-sources";

    link.download = `stockai-corporate-actions-${statusLabel}-${typeLabel}-${sourceLabel}-${sortLabel}${dateSuffix ? "-" + dateSuffix : ""}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  async function loadCorporateActions() {
    setCorporateActionsLoading(true);
    setCorporateActionsError("");

    try {
      const query =
        corporateActionsFilter === "ALL"
          ? ""
          : `?status=${encodeURIComponent(corporateActionsFilter)}`;

      const [result, summaryResult] = await Promise.all([
        request(`/api/corporate-actions${query}`),
        request("/api/corporate-actions")
      ]);

      setCorporateActions(
        Array.isArray(result.actions) ? result.actions : []
      );

      setCorporateActionsSummary(
        Array.isArray(summaryResult.actions) ? summaryResult.actions : []
      );
    } catch (err) {
      setCorporateActionsError(
        err.message || "Unable to load corporate actions."
      );
    } finally {
      setCorporateActionsLoading(false);
    }
  }


  async function handleAdminLogin(event) {
    event.preventDefault();
    setAdminLoginError("");
    setAdminLoginLoading(true);

    try {
      const result = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail.trim(), password: adminPassword })
      });

      if (!result.token || result.user?.role !== "ADMIN") {
        throw new Error("This account does not have administrator access.");
      }

      sessionStorage.setItem("stockai-admin-token", result.token);
      setAdminToken(result.token);
      setAdminUser(result.user);
      setAdminPassword("");
      setAdminReviewError("");
      setAdminReviewSuccess("");
    } catch (error) {
      setAdminLoginError(error.message || "Administrator login failed.");
    } finally {
      setAdminLoginLoading(false);
    }
  }

  function handleAdminLogout() {
    sessionStorage.removeItem("stockai-admin-token");
    setAdminToken("");
    setAdminUser(null);
    setAdminPassword("");
    setAdminReviewNotes({});
    setAdminReviewError("");
    setAdminReviewSuccess("");
  }

  async function handleCorporateActionReview(action, status) {
    const reviewNote = String(adminReviewNotes[action.id] || "").trim();

    if (!adminToken || adminUser?.role !== "ADMIN") {
      setAdminReviewError("Administrator login is required.");
      return;
    }

    if (reviewNote.length < 10 || reviewNote.length > 1000) {
      setAdminReviewError("Review notes must contain 10 to 1000 characters.");
      return;
    }

    const label = status === "VERIFIED" ? "verify" : "reject";
    if (!window.confirm(
      `Are you sure you want to ${label} the ${action.symbol} corporate action? Check the original disclosure first.`
    )) return;

    setAdminReviewBusyId(action.id);
    setAdminReviewError("");
    setAdminReviewSuccess("");

    try {
      await request(`/api/corporate-actions/${action.id}/verification`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status, reviewNote })
      });

      setAdminReviewNotes((previous) => {
        const next = { ...previous };
        delete next[action.id];
        return next;
      });

      setAdminReviewSuccess(`${action.symbol} successfully marked ${status}.`);
      await loadCorporateActions();
    } catch (error) {
      if (/token|authentication/i.test(error.message)) {
        sessionStorage.removeItem("stockai-admin-token");
        setAdminToken("");
        setAdminUser(null);
      }
      setAdminReviewError(error.message || "Unable to review this action.");
    } finally {
      setAdminReviewBusyId(null);
    }
  }

  async function loadListings(event) {
    event.preventDefault();

    setListingsLoading(true);
    setListingsError("");
    setListings([]);
    setListingsSearched(false);

    try {
      const query = new URLSearchParams({
        exchange: listingExchange,
        search: listingSearch.trim(),
      });

      const result = await request(
        `/api/company-listings?${query.toString()}`
      );

      if (result.status !== "success") {
        throw new Error("The listing service returned an unsuccessful response.");
      }

      setListings(
        Array.isArray(result.listings) ? result.listings : []
      );
      setListingsSearched(true);
    } catch (err) {
      setListingsError(
        err.message || "Unable to load exchange listings."
      );
      setListingsSearched(true);
    } finally {
      setListingsLoading(false);
    }
  }
  useEffect(() => {
    loadCorporateActions();
  }, [corporateActionsFilter]);

  useEffect(() => {
    setCorporateActionsPage(1);
    setExpandedCorporateActionIds([]);
  }, [
    corporateActionsFilter,
    corporateActionsTypeFilter,
    corporateActionsSourceFilter,
    corporateActionsSearch,
    corporateActionsFromDate,
    corporateActionsToDate,
    corporateActionsSort,
    corporateActionsPageSize
  ]);

      async function loadSentiment() {
    setSentimentLoading(true);
    setSentimentError("");

    try {
      const company = companies.find(
        (item) => item.symbol === selected
      );

      const stock = (market?.stockData || []).find(
        (item) => item.symbol === selected
      );

      let companyName = company?.name || stock?.name || selected;

      if (selected.toUpperCase() === "BEL") {
        companyName = "Bharat Electronics Limited";
      }

      const query = encodeURIComponent(`${companyName} ${selected}`);

      const result = await request(
        `/api/news/sentiment?q=${query}`
      );

      setSentiment(result);
    } catch (err) {
      setSentimentError(
        err.message || "Unable to load sentiment data."
      );
    } finally {
      setSentimentLoading(false);
    }
  }

  async function refreshNews() {
    setSentimentLoading(true);
    setSentimentError("");

    try {
      const result = await request("/api/news");

      setNews(result);
      setNewsRefreshKey((current) => current + 1);

      const sentimentResult = await request("/api/news/sentiment");
      setSentiment(sentimentResult);

      if (newsFilter === "company") {
        // Reload company-specific headlines using the existing effect.
        setCompanyNews(null);
      }
    } catch (err) {
      setSentimentError(
        err.message || "Unable to refresh news."
      );
    } finally {
      setSentimentLoading(false);
    }
  }



  useEffect(() => {
    if (newsFilter !== "company") return;

    let active = true;

    async function loadCompanyNews() {
      setSentimentLoading(true);
      setSentimentError("");

      try {
        const company = companies.find(
          (item) => item.symbol === selected
        );

        const stock = (market?.stockData || []).find(
          (item) => item.symbol === selected
        );

        let companyName =
          company?.name || stock?.name || selected;

        // Use the full company name for BEL searches.
        if (selected.toUpperCase() === "BEL") {
          companyName = "Bharat Electronics Limited";
        }

        const query = `${companyName} ${selected}`;
        const encodedQuery = encodeURIComponent(query);

        const result = await request(
          `/api/news?q=${encodedQuery}`
        );

        if (!active) return;

        // The backend already receives a company-specific search query.
        // Keep its returned articles instead of applying a second,
        // overly strict title/source filter that can discard valid news.
        const items = Array.isArray(result?.news)
          ? result.news
          : [];

        setCompanyNews({
          ...result,
          news: items,
          total: items.length,
        });

        const sentimentResult = await request(
          `/api/news/sentiment?q=${encodedQuery}`
        ).catch(() => null);

        if (active && sentimentResult) {
          setSentiment(sentimentResult);
        }
      } catch (err) {
        if (active) {
          setCompanyNews({
            news: [],
            total: 0,
          });

          setSentimentError(
            err.message || "Unable to load company news."
          );
        }
      } finally {
        if (active) {
          setSentimentLoading(false);
        }
      }
    }

    loadCompanyNews();

    return () => {
      active = false;
    };
  }, [selected, newsFilter, newsRefreshKey, companies, market?.stockData]);

  useEffect(() => {
    let active = true;

    Promise.all([
      request("/api/market"),
      request("/api/companies"),
      request("/api/news"),
    ])
      .then(([marketData, companyData, newsData]) => {
        if (!active) return;

        setMarket(marketData);

        setCompanies(
          Array.isArray(companyData)
            ? companyData
            : companyData.companies || companyData.data || []
        );

        setNews(newsData);
        loadSentiment();
      })
      .catch((err) => {
        if (!active) return;

        setError(
          "Could not load dashboard data. Check that the backend is running on port 5000."
        );
        console.error(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const analysisQuery = new URLSearchParams({
      exchange: selectedExchange,
    }).toString();

    const endpoints = {
      profile: `/api/companies/${encodeURIComponent(selected)}?${analysisQuery}`,
      intelligence: `/api/company-intelligence/${encodeURIComponent(selected)}?${analysisQuery}`,
      technical: `/api/technical-analysis/${encodeURIComponent(selected)}?${analysisQuery}`,
      prediction: `/api/prediction/${encodeURIComponent(selected)}?${analysisQuery}`,
      financial: `/api/financial-analysis/${encodeURIComponent(selected)}?${analysisQuery}`,
      risk: `/api/risk-analysis/${encodeURIComponent(selected)}?${analysisQuery}`,
      fundamentals: `/api/fundamentals/${encodeURIComponent(selected)}?${analysisQuery}`,
    };


    Promise.all(
      Object.entries(endpoints).map(async ([key, path]) => {
        try {
          return [key, await request(path)];
        } catch (err) {
          return [key, { error: err.message }];
        }
      })
    ).then((results) => {
      if (active) setDetails(Object.fromEntries(results));
    });

    return () => {
      active = false;
    };
  }, [selected, selectedExchange]);

  const supportedAnalysisCompanies = [
    { name: "Infosys Limited", symbol: "INFY" },
    { name: "HDFC Bank Limited", symbol: "HDFCBANK" },
    { name: "ICICI Bank Limited", symbol: "ICICIBANK" },
    { name: "ITC Limited", symbol: "ITC" },
    { name: "Larsen & Toubro Limited", symbol: "LT" },
    { name: "Axis Bank Limited", symbol: "AXISBANK" },
    { name: "Kotak Mahindra Bank Limited", symbol: "KOTAKBANK" },
    { name: "Hindustan Unilever Limited", symbol: "HINDUNILVR" },
    { name: "Bharti Airtel Limited", symbol: "BHARTIARTL" },
    { name: "Maruti Suzuki India Limited", symbol: "MARUTI" },
    { name: "Sun Pharmaceutical Industries Limited", symbol: "SUNPHARMA" },
    { name: "Wipro Limited", symbol: "WIPRO" },
    { name: "NTPC Limited", symbol: "NTPC" },
    { name: "Power Grid Corporation of India Limited", symbol: "POWERGRID" },
    { name: "Tata Steel Limited", symbol: "TATASTEEL" },
    { name: "Oil and Natural Gas Corporation Limited", symbol: "ONGC" },
    { name: "Tata Power Company Limited", symbol: "TATAPOWER" },
    { name: "Tata Motors Passenger Vehicles Limited", symbol: "TMPV" },
    { name: "Tata Motors Commercial Vehicles Limited", symbol: "TMCV" },
    { name: "JSW Steel Limited", symbol: "JSWSTEEL" },
    { name: "UltraTech Cement Limited", symbol: "ULTRACEMCO" },
    { name: "Asian Paints Limited", symbol: "ASIANPAINT" },
  ];

  const allCompanies = companies.filter((company) => company.symbol !== "TATAMOTORS");

  supportedAnalysisCompanies.forEach((company) => {
    if (!allCompanies.some((item) => item.symbol === company.symbol)) {
      allCompanies.push(company);
    }
  });

  const visibleCompanies = allCompanies.filter((company) =>
    `${company.name || ""} ${company.symbol || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const indices = market?.indices || [];
  const stocks = market?.stockData || [];

  const newsItems = Array.isArray(news?.news) ? news.news : [];

  const selectedCompanyName =
    allCompanies.find((company) => company.symbol === selected)?.name ||
    stocks.find((stock) => stock.symbol === selected)?.name ||
    selected;

  const companyNewsItems = Array.isArray(companyNews?.news)
    ? companyNews.news
    : [];

  const displayedNews =
    newsFilter === "company" ? companyNewsItems : newsItems;
  const gainers = market?.gainers || [];
  const losers = market?.losers || [];

  function addHolding(event) {
    event.preventDefault();

    const entry = Number(buyPrice);
    const shares = Number(quantity);

    if (!Number.isFinite(entry) || entry <= 0 ||
        !Number.isFinite(shares) || shares <= 0) {
      alert("Enter a valid buy price and quantity.");
      return;
    }

    setWatchlist((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${Math.random()}`,
        symbol: portfolioSymbol,
        buyPrice: entry,
        quantity: shares,
      },
    ]);

    setBuyPrice("");
    setQuantity("1");
  }

  function removeHolding(id) {
    setWatchlist((previous) =>
      previous.filter((holding) => holding.id !== id)
    );
  }

  const portfolioRows = watchlist.map((holding) => {
    const stock = stocks.find(
      (item) => item.symbol === holding.symbol
    );


    const price = Number(stock?.price);
    const priceAvailable =

      Boolean(stock) &&
      stock.dataStatus !== "UNAVAILABLE" &&
      Number.isFinite(price) &&
      price > 0;

    const invested = holding.buyPrice * holding.quantity;

    return {
      ...holding,
      name: stock?.name || holding.symbol,
      currentPrice: priceAvailable ? price : null,
      invested,
      currentValue: priceAvailable ? price * holding.quantity : null,
      profitLoss: priceAvailable
        ? (price - holding.buyPrice) * holding.quantity
        : null,
      priceAvailable,
      quoteTimestamp: stock?.regularMarketTime ?? null,
      dataStatus: stock?.dataStatus || "Price unavailable",
    };
  });

  const pricedRows = portfolioRows.filter(
    (holding) => holding.priceAvailable
  );

  // All saved holdings contribute to recorded investment.
  const totalInvested = portfolioRows.reduce(
    (sum, holding) => sum + holding.invested, 0
  );

  // Only holdings with valid current prices contribute to these metrics.
  const pricedInvested = pricedRows.reduce(
    (sum, holding) => sum + holding.invested, 0
  );

  const totalCurrentValue = pricedRows.reduce(
    (sum, holding) => sum + holding.currentValue, 0
  );

  const totalProfitLoss = pricedRows.reduce(
    (sum, holding) => sum + holding.profitLoss, 0
  );

  const totalReturn = pricedInvested > 0
    ? (totalProfitLoss / pricedInvested) * 100
    : 0;

  const formatINR = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);


  return (
    <div className="app">
      <header className="navbar">
        <div className="container">
          <a className="logo" href="#home">StockAI</a>
          <nav>
            <a href="#market">Market</a>
            <a href="#companies">Companies</a>
            <a href="#listings">Listings</a>
            <a href="#portfolio">Portfolio</a>
            <a href="#analysis">Analysis</a>
            <a href="#corporate-actions">Corporate Actions</a>
            <a href="#news">News</a>
          </nav>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="container">
          <span className="section-label">STOCK MARKET INTELLIGENCE</span>
          <h1>Understand the market. Analyse with confidence.</h1>
          <p>
            Explore market indices, stock performance, company intelligence,
            technical indicators, predictions and risk analysis.
          </p>
          <a className="primary-button" href="#market">Explore Dashboard</a>
        </div>
      </section>

      <main className="container">
        <section className="section" id="listings">
          <span className="section-label">EXCHANGE DIRECTORY</span>
          <h2 style={{ marginTop: 8 }}>NSE &amp; BSE Listings</h2>
          <p className="data-status">
            Search imported exchange identifiers. These records are not live prices.
          </p>

          <form
            onSubmit={loadListings}
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 20,
              marginBottom: 20,
            }}
          >
            <select
              value={listingExchange}
              onChange={(event) => setListingExchange(event.target.value)}
              aria-label="Select exchange"
              style={{
                background: "#111c2e",
                color: "#f8fafc",
                border: "1px solid #263a52",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>

            <input
              type="text"
              value={listingSearch}
              onChange={(event) => setListingSearch(event.target.value)}
              placeholder="Search company, symbol, security code or ISIN"
              aria-label="Search company listings"
              style={{
                flex: "1 1 220px",
                minWidth: 0,
                background: "#111c2e",
                color: "#f8fafc",
                border: "1px solid #263a52",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            />

            <button
              type="submit"
              className="primary-button"
              disabled={listingsLoading}
            >
              {listingsLoading ? "Searching..." : "Search Listings"}
            </button>
          </form>

          {listingsSearched && !listingsLoading &&
            !listingsError && listings.length > 0 && (
              <p className="data-status" style={{ marginBottom: 14 }}>
                Found <strong>{listings.length.toLocaleString("en-IN")}</strong>
                matching {listingExchange} listings
                {listingSearch.trim() ? ` for "${listingSearch.trim()}"` : ""}.
              </p>
            )}
          {listingsError && (
            <p role="alert" style={{ color: "#fb7185" }}>
              {listingsError}
            </p>
          )}

          {listingsSearched && !listingsLoading &&
            !listingsError && listings.length === 0 && (
              <p className="data-status">
                No imported listings found. Try another symbol or exchange.
              </p>
            )}

          {listings.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 650,
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr>
                    {["Company", "Exchange", "Symbol", "Series", "Security Code", "ISIN", "Status", "Action"].map((heading) => (
                      <th key={heading} style={{
                        padding: 12,
                        borderBottom: "1px solid #263a52",
                        color: "#94a3b8",
                        fontSize: 12,
                      }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listings.map((item, index) => (
                    <tr key={`${item.exchange}-${item.symbol}-${item.securityCode || index}`}>
                      <td style={{ padding: 12 }}>
                        <strong>{item.name || item.symbol}</strong>
                        <div className="data-status">
                          {item.sector || "Sector unavailable"}
                        </div>
                      </td>
                      <td style={{ padding: 12 }}>{item.exchange || "N/A"}</td>
                      <td style={{ padding: 12 }}>
                        {item.exchangeSymbol || item.symbol || "N/A"}
                      </td>
                      <td style={{ padding: 12 }}>{item.series || "Not available"}</td>
                      <td style={{ padding: 12, whiteSpace: "nowrap" }}>
  {item.securityCode || "Not available"}
  {item.securityCode && (
    <button type="button" className="primary-button"
      style={{ marginLeft: 8, padding: "4px 8px", fontSize: 11 }}
      onClick={() => copyIdentifier(item.securityCode, setCopiedIdentifier)}>
      {copiedIdentifier === String(item.securityCode) ? "Copied!" : "Copy"}
    </button>
  )}
</td>
                      <td style={{ padding: 12, whiteSpace: "nowrap" }}>
  {item.isin || "Not available"}
  {item.isin && (
    <button type="button" className="primary-button"
      style={{ marginLeft: 8, padding: "4px 8px", fontSize: 11 }}
      onClick={() => copyIdentifier(item.isin, setCopiedIdentifier)}>
      {copiedIdentifier === String(item.isin) ? "Copied!" : "Copy"}
    </button>
  )}
</td>
                      <td style={{
                        padding: 12,
                        color: item.listingStatus === "ACTIVE" ? "#34d399" : "#fbbf24",
                      }}>
                        {item.listingStatus || "Unknown"}
                      </td>
                      <td style={{ padding: 12 }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{ whiteSpace: "nowrap", fontSize: 12 }}
                          onClick={() => {
                            setSelectedExchange(item.exchange || listingExchange);
                            setSelected(item.symbol);
                            document.getElementById("market")?.scrollIntoView({
                              behavior: "smooth",
                            });
                          }}
                        >
                          Select for Analysis
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="data-status" style={{ marginTop: 16 }}>
            Source: StockAI imported listings database. Verify identifiers with the
            official exchange before making trading decisions.
          </p>
        </section>

        <section className="section" id="market">
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div>
              <span className="section-label">INDIAN EQUITY MARKET</span>
              <h2 style={{ marginTop: 8 }}>Market Overview</h2>
            </div>
            <span className="data-status">
              {loading ? "Fetching data..." : market?.provider || "Market data"}
            </span>
          </div>

          {error && <p style={{ color: "#fb7185" }}>{error}</p>}

          <div className="stats-grid">
            {indices.map((index) => (
              <article className="stat-card" key={index.symbol}>
                <span>{index.name}</span>
                <strong style={{ fontSize: 27, color: "#f8fafc" }}>
                  {formatPrice(index.value)}
                </strong>
                <Change value={index.change} percent={index.changePercent} />
                <span className="data-status">
                  {index.dataStatus || market?.dataStatus || "Status unknown"}
                </span>
              </article>
            ))}
          </div>

          <div className="stats-grid" style={{ marginTop: 16 }}>
            <Metric
              label="Advancing stocks"
              value={market?.marketBreadth?.advancing ?? "N/A"}
              color="#34d399"
            />
            <Metric
              label="Declining stocks"
              value={market?.marketBreadth?.declining ?? "N/A"}
              color="#fb7185"
            />
            <Metric
              label="Tracked stocks"
              value={market?.marketBreadth?.totalTracked ?? "N/A"}
            />
          </div>

          <p className="data-status" style={{ marginTop: 16 }}>
            Provider data may be delayed or unavailable. Figures are
            informational and are not guaranteed live quotes.
          </p>

          <div className="stats-grid">
            <article className="stat-card">
              <h3>Top Gainers</h3>
              {gainers.length ? gainers.map((stock) => (
                <div key={stock.symbol} style={{ marginBottom: 12 }}>
                  <strong>{stock.name}</strong>
                  <div>{formatPrice(stock.price)}</div>
                  <Change value={stock.change} percent={stock.changePercent} />
                </div>
              )) : <span>No gainers available</span>}
            </article>

            <article className="stat-card">
              <h3>Top Losers</h3>
              {losers.length ? losers.map((stock) => (
                <div key={stock.symbol} style={{ marginBottom: 12 }}>
                  <strong>{stock.name}</strong>
                  <div>{formatPrice(stock.price)}</div>
                  <Change value={stock.change} percent={stock.changePercent} />
                </div>
              )) : <span>No losers available</span>}
            </article>
          </div>
        </section>

        <section className="section" id="companies">
          <h2>Company Explorer</h2>
          <input
            className="search-input"
            placeholder="Search company or symbol..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="company-grid">
            {visibleCompanies.map((company, index) => (
              <button
                type="button"
                className="company-card"
                key={company.symbol || index}
                onClick={() => setSelected(company.symbol)}
                style={{
                  borderColor: selected === company.symbol
                    ? "#38bdf8" : undefined,
                }}
              >
                <strong>{company.name || company.symbol}</strong>
                <span>{company.symbol}</span>
                {selected === company.symbol && (
                  <span style={{ color: "#38bdf8" }}>Selected</span>
                )}
              </button>
            ))}
          </div>

          {visibleCompanies.length === 0 && (
            <p className="data-status">No companies match your search.</p>
          )}

          <p>
            Selected company: <strong>{selected}</strong>
          </p>
        </section>

        <section className="section" id="analysis">
          <h2>Historical Stock Chart</h2>

        <section className="section" id="portfolio">
          <span className="section-label">YOUR INVESTMENT WORKSPACE</span>
          <h2>Watchlist &amp; Portfolio Simulator</h2>
          <p className="data-status">
            Hypothetical holdings based on available backend prices.
            This does not place real orders.
          </p>

          <form className="portfolio-form" onSubmit={addHolding}>
            <label>
              Stock
              <select
                value={portfolioSymbol}
                onChange={(event) => setPortfolioSymbol(event.target.value)}
              >
                {stocks.map((stock) => (
                  <option key={stock.symbol} value={stock.symbol}>
                    {stock.symbol} - {stock.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Buy price (INR)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={buyPrice}
                onChange={(event) => setBuyPrice(event.target.value)}
                placeholder="e.g. 350"
              />
            </label>

            <label>
              Quantity
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>

            <button className="primary-button" type="submit">
              Add holding
            </button>
          </form>

          <div className="stats-grid">
            <Metric
              label="Total recorded investment"
              value={formatINR(totalInvested)}
            />
            <Metric
              label="Current value (priced holdings)"
              value={formatINR(totalCurrentValue)}
            />
            <Metric
              label="Profit / Loss (priced holdings)"
              value={formatINR(totalProfitLoss)}
              color={totalProfitLoss >= 0 ? "#34d399" : "#fb7185"}
            />
            <Metric
              label="Return (priced holdings)"
              value={`${totalReturn.toFixed(2)}%`}
              color={totalReturn >= 0 ? "#34d399" : "#fb7185"}
            />
          </div>

          <p className="data-status">
            Totals include only holdings with an available price. Values
            may be delayed and are estimates, not executable market quotes.
          </p>

          {portfolioRows.length === 0 ? (
            <div className="loading-card">
              Your watchlist is empty. Add a stock above to begin.
            </div>
          ) : (
            <div className="portfolio-table-wrap">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th>Buy price</th>
                    <th>Quantity</th>
                    <th>Current price</th>
                    <th>Invested</th>
                    <th>Current value</th>
                    <th>Profit / Loss</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioRows.map((holding) => (
                    <tr key={holding.id}>
                      <td>
                        <strong>{holding.symbol}</strong>
                        <div className="data-status">{holding.name}</div>
                      </td>
                      <td>{formatINR(holding.buyPrice)}</td>
                      <td>{holding.quantity}</td>
                      <td>
                        {holding.priceAvailable
                          ? formatINR(holding.currentPrice)
                          : "Unavailable"}
                        {!holding.priceAvailable && (
                          <div className="data-status">
                            {holding.dataStatus}
                          </div>
                        )}
                      </td>
                      <td>{formatINR(holding.invested)}</td>
                      <td>
                        {holding.priceAvailable
                          ? formatINR(holding.currentValue)
                          : "N/A"}
                      </td>
                      <td
                        style={{
                          color: holding.profitLoss == null
                            ? "#94a3b8"
                            : holding.profitLoss >= 0
                              ? "#34d399"
                              : "#fb7185",
                        }}
                      >
                        {holding.profitLoss == null
                          ? "N/A"
                          : formatINR(holding.profitLoss)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => removeHolding(holding.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

          <Suspense fallback={<div className="loading-card">Loading historical chart...</div>}>
            <StockChart symbol={selected} />
          </Suspense>
        </section>

        <section className="section" id="corporate-actions">
          <h2>Corporate Actions</h2>
          <p>Track announced bonus issues and stock splits with their verification status and original sources.</p>
          <div className="corporate-actions-disclaimer">
            <strong>Data Quality & Verification Notice</strong>
            <ul>
              <li>Announced corporate actions remain pending until independently verified.</li>
              <li>Only VERIFIED bonus issues and stock splits are used for adjusted EPS calculations.</li>
              <li>Check the original company and exchange disclosures before relying on any corporate action.</li>
            </ul>
          </div>

          <div style={{ padding: 18, marginBottom: 20, border: "1px solid #334155", borderRadius: 12, background: "rgba(15, 23, 42, 0.7)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Administrator Review Access</h3>
            {adminUser?.role === "ADMIN" ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong style={{ color: "#86efac" }}>Administrator logged in</strong>
                  <p style={{ margin: "5px 0 0", color: "#94a3b8", fontSize: 13 }}>{adminUser.email}</p>
                </div>
                <button type="button" className="secondary-button" onClick={handleAdminLogout}>Logout</button>
              </div>
            ) : (
              <form onSubmit={handleAdminLogin} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
                <label style={{ display: "grid", gap: 6, color: "#cbd5e1", fontSize: 13 }}>
                  Administrator Email
                  <input type="email" autoComplete="username" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required placeholder="Administrator email" style={{ width: "100%", padding: 10, borderRadius: 7 }} />
                </label>
                <label style={{ display: "grid", gap: 6, color: "#cbd5e1", fontSize: 13 }}>
                  Password
                  <input type="password" autoComplete="current-password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required style={{ width: "100%", padding: 10, borderRadius: 7 }} />
                </label>
                <button type="submit" className="primary-button" disabled={adminLoginLoading}>
                  {adminLoginLoading ? "Signing in..." : "Administrator Login"}
                </button>
              </form>
            )}
            {adminLoginError && <p role="alert" style={{ color: "#fca5a5" }}>{adminLoginError}</p>}
            {adminReviewError && <p role="alert" style={{ color: "#fca5a5" }}>{adminReviewError}</p>}
            {adminReviewSuccess && <p role="status" style={{ color: "#86efac" }}>{adminReviewSuccess}</p>}
          </div>

          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <article className="stat-card">
              <span>Total Actions</span>
              <strong style={{ fontSize: 27 }}>{corporateActionCounts.total}</strong>
            </article>

            <article className="stat-card">
              <span>Pending Verification</span>
              <strong style={{ fontSize: 27, color: "#f59e0b" }}>{corporateActionCounts.pending}</strong>
            </article>

            <article className="stat-card">
              <span>Verified Actions</span>
              <strong style={{ fontSize: 27, color: "#22c55e" }}>{corporateActionCounts.verified}</strong>
            </article>

            <article className="stat-card">
              <span>Rejected Actions</span>
              <strong style={{ fontSize: 27, color: "#ef4444" }}>{corporateActionCounts.rejected}</strong>
            </article>

            <article className="stat-card">
              <span>Bonus Issues</span>
              <strong style={{ fontSize: 27 }}>{corporateActionCounts.bonusIssues}</strong>
            </article>

            <article className="stat-card">
              <span>Stock Splits</span>
              <strong style={{ fontSize: 27 }}>{corporateActionCounts.stockSplits}</strong>
            </article>

            <article className="stat-card">
              <span>Verification Progress</span>
              <strong style={{ fontSize: 27, color: "#22c55e" }}>
                {corporateActionVerificationProgress}%
              </strong>
              <div style={{ height: 7, background: "#334155", borderRadius: 10, overflow: "hidden", marginTop: 10 }}>
                <div
                  style={{
                    width: `${corporateActionVerificationProgress}%`,
                    height: "100%",
                    background: "#22c55e",
                    borderRadius: 10,
                    transition: "width 0.3s ease"
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                {corporateActionCounts.verified} of {corporateActionCounts.total} actions verified
              </span>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 10, fontSize: 11 }}>
                <span style={{ color: "#22c55e" }}>Verified {corporateActionVerificationProgress}% ({corporateActionCounts.verified})</span>
                <span style={{ color: "#f59e0b" }}>Pending {corporateActionPendingProgress}% ({corporateActionCounts.pending})</span>
                <span style={{ color: "#ef4444" }}>Rejected {corporateActionRejectedProgress}% ({corporateActionCounts.rejected})</span>
              </div>
              <div style={{ display: "flex", height: 9, width: "100%", overflow: "hidden", borderRadius: 10, background: "#334155", marginTop: 9 }}>
                <div title={`Verified: ${corporateActionVerificationProgress}%`} style={{ width: `${corporateActionVerificationProgress}%`, background: "#22c55e", transition: "width 0.3s ease" }} />
                <div title={`Pending: ${corporateActionPendingProgress}%`} style={{ width: `${corporateActionPendingProgress}%`, background: "#f59e0b", transition: "width 0.3s ease" }} />
                <div title={`Rejected: ${corporateActionRejectedProgress}%`} style={{ width: `${corporateActionRejectedProgress}%`, background: "#ef4444", transition: "width 0.3s ease" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, fontSize: 10, color: "#94a3b8" }}>
                <span title="Actions confirmed against reliable original sources" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} /> Verified
                </span>
                <span title="Actions awaiting verification" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b" }} /> Pending
                </span>
                <span title="Actions rejected during verification" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} /> Rejected
                </span>
              </div>
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "rgba(148, 163, 184, 0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Verification Coverage</span>
                  <strong style={{ fontSize: 15, color: "#38bdf8" }}>{corporateActionVerificationCoverage}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 5, fontSize: 10, color: "#94a3b8" }}>
                  <span>Reviewed: {corporateActionReviewedCount}</span>
                  <span>Awaiting review: {corporateActionCounts.pending}</span>
                </div>
                <div title={`Verification coverage: ${corporateActionVerificationCoverage}%`} style={{ height: 6, width: "100%", background: "#334155", borderRadius: 10, overflow: "hidden", marginTop: 9 }}>
                  <div style={{ height: "100%", width: `${corporateActionVerificationCoverage}%`, background: "#38bdf8", borderRadius: 10, transition: "width 0.3s ease" }} />
                </div>
                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Review Status</span>
                  <strong style={{ fontSize: 11, padding: "5px 9px", borderRadius: 20, color: corporateActionReviewStatus === "All actions reviewed" ? "#22c55e" : corporateActionReviewStatus === "Review not started" ? "#f59e0b" : corporateActionReviewStatus === "Review in progress" ? "#38bdf8" : "#94a3b8", background: corporateActionReviewStatus === "All actions reviewed" ? "rgba(34, 197, 94, 0.12)" : corporateActionReviewStatus === "Review not started" ? "rgba(245, 158, 11, 0.12)" : corporateActionReviewStatus === "Review in progress" ? "rgba(56, 189, 248, 0.12)" : "rgba(148, 163, 184, 0.12)" }}>
                    {corporateActionReviewStatus}
                  </strong>
                </div>
              </div>
            </article>
            <article className="stat-card">
              <span>Source Coverage</span>
              <strong style={{ fontSize: 27, color: "#38bdf8" }}>
                {corporateActionsSourceCoverage}%
              </strong>
              <div style={{ height: 7, background: "#334155", borderRadius: 10, overflow: "hidden", marginTop: 10 }}>
                <div style={{ width: `${corporateActionsSourceCoverage}%`, height: "100%", background: "#38bdf8", borderRadius: 10, transition: "width 0.3s ease" }} />
              </div>
              <span style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                {corporateActionsSourceCounts.available} of {corporateActions.length} actions have source links
              </span>
              <span style={{ fontSize: 11, color: "#f59e0b", marginTop: 5 }}>
                Link availability does not mean independently verified.
              </span>
            </article>
          </div>

          <div className="corporate-actions-toolbar" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {["ALL", "PENDING", "VERIFIED", "REJECTED"].map((status) => (
              <button
                key={status}
                type="button"
                className={corporateActionsFilter === status ? "primary-button" : "secondary-button"}
                onClick={() => setCorporateActionsFilter(status)}
              >
                {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}

            {[
              { value: "ALL", label: "All Types" },
              { value: "BONUS", label: "Bonus Issues" },
              { value: "STOCK_SPLIT", label: "Stock Splits" }
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                className={corporateActionsTypeFilter === type.value ? "primary-button" : "secondary-button"}
                onClick={() => setCorporateActionsTypeFilter(type.value)}
              >
                {type.label}
              </button>
            ))}

            {[
              { value: "ALL", label: `All Sources (${corporateActions.length})` },
              { value: "AVAILABLE", label: `Links Available (${corporateActionsSourceCounts.available})` },
              { value: "MISSING", label: `Source Missing (${corporateActionsSourceCounts.missing})` }
            ].map((source) => (
              <button
                key={source.value}
                type="button"
                className={corporateActionsSourceFilter === source.value ? "primary-button" : "secondary-button"}
                onClick={() => setCorporateActionsSourceFilter(source.value)}
              >
                {source.label}
              </button>
            ))}

            {[
              { value: "EFFECTIVE_NEWEST", label: "Effective Date: Newest First" },
              { value: "EFFECTIVE_OLDEST", label: "Effective Date: Oldest First" },
              { value: "ANNOUNCEMENT_NEWEST", label: "Announcement Date: Newest First" },
              { value: "ANNOUNCEMENT_OLDEST", label: "Announcement Date: Oldest First" }
            ].map((sort) => (
              <button
                key={sort.value}
                type="button"
                className={corporateActionsSort === sort.value ? "primary-button" : "secondary-button"}
                onClick={() => setCorporateActionsSort(sort.value)}
              >
                {sort.label}
              </button>
            ))}

            <button
              type="button"
              className="secondary-button"
              onClick={loadCorporateActions}
              disabled={corporateActionsLoading}
            >
              {corporateActionsLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={exportCorporateActionsCsv}
              title="Exports all matching filtered actions across every page, not just the current page."
              disabled={corporateActionsLoading || filteredCorporateActions.length === 0}
            >
              Download CSV ({filteredCorporateActions.length})
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setCorporateActionsFilter("ALL");
                setCorporateActionsTypeFilter("ALL");
                setCorporateActionsSourceFilter("ALL");
                setCorporateActionsSearch("");
                setCorporateActionsFromDate("");
                setCorporateActionsToDate("");
                setCorporateActionsSort("EFFECTIVE_NEWEST");
                setCorporateActionsPage(1);
                setCorporateActionsPageSize(10);
              }}
              disabled={
                corporateActionsFilter === "ALL" &&
                corporateActionsTypeFilter === "ALL" &&
                corporateActionsSourceFilter === "ALL" &&
                !corporateActionsSearch &&
                !corporateActionsFromDate &&
                !corporateActionsToDate &&
                corporateActionsSort === "EFFECTIVE_NEWEST" &&
                corporateActionsPage === 1 &&
                corporateActionsPageSize === 10
              }
            >
              Reset Filters
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={paginatedCorporateActions.length === 0}
              onClick={() => {
                const allExpanded = paginatedCorporateActions.every((action) => expandedCorporateActionIds.includes(action.id));
                setExpandedCorporateActionIds(
                  allExpanded ? [] : paginatedCorporateActions.map((action) => action.id)
                );
              }}
            >
              {paginatedCorporateActions.length > 0 && paginatedCorporateActions.every((action) => expandedCorporateActionIds.includes(action.id)) ? "Collapse All" : "Expand All"}
            </button>
            <div title="Review coverage = (Verified + Rejected) / Total Actions × 100. Pending actions are not counted as reviewed." style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: corporateActionReviewStatus === "All actions reviewed" ? "rgba(34, 197, 94, 0.08)" : corporateActionReviewStatus === "Review not started" ? "rgba(245, 158, 11, 0.08)" : corporateActionReviewStatus === "Review in progress" ? "rgba(56, 189, 248, 0.08)" : "rgba(148, 163, 184, 0.08)", border: `1px solid ${corporateActionReviewStatus === "All actions reviewed" ? "rgba(34, 197, 94, 0.2)" : corporateActionReviewStatus === "Review not started" ? "rgba(245, 158, 11, 0.2)" : corporateActionReviewStatus === "Review in progress" ? "rgba(56, 189, 248, 0.2)" : "rgba(148, 163, 184, 0.2)"}` }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Review Progress</span>
              <strong style={{ fontSize: 12, color: corporateActionReviewStatus === "All actions reviewed" ? "#22c55e" : corporateActionReviewStatus === "Review not started" ? "#f59e0b" : corporateActionReviewStatus === "Review in progress" ? "#38bdf8" : "#94a3b8" }}>{corporateActionVerificationCoverage}%</strong>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>({corporateActionReviewedCount}/{corporateActionCounts.total} reviewed)</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <input
              type="text"
              value={corporateActionsSearch}
              onChange={(event) => setCorporateActionsSearch(event.target.value)}
              placeholder="Search company symbol (e.g. HDFCBANK)"
              style={{
                width: "100%",
                maxWidth: 360,
                padding: "11px 14px",
                borderRadius: 8,
                border: "1px solid #3a4558",
                background: "#111827",
                color: "#ffffff",
                fontSize: 14
              }}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => setCorporateActionsSearch("")}
              disabled={!corporateActionsSearch}
            >
              Clear
            </button>
            <label style={{ color: "#9ca3af", fontSize: 13 }}>From Date</label>
            <input type="date" aria-label="Effective date from" value={corporateActionsFromDate} onChange={(event) => setCorporateActionsFromDate(event.target.value)} style={{ padding: "10px", borderRadius: 8, border: "1px solid #3a4558", background: "#111827", color: "#ffffff" }} />
            <label style={{ color: "#9ca3af", fontSize: 13 }}>To Date</label>
            <input type="date" aria-label="Effective date to" value={corporateActionsToDate} min={corporateActionsFromDate || undefined} onChange={(event) => setCorporateActionsToDate(event.target.value)} style={{ padding: "10px", borderRadius: 8, border: "1px solid #3a4558", background: "#111827", color: "#ffffff" }} />
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setCorporateActionsFromDate("");
                setCorporateActionsToDate("");
              }}
              disabled={!corporateActionsFromDate && !corporateActionsToDate}
            >
              Clear Dates
            </button>
          </div>
          {corporateActionsLoading && (
            <div className="loading-card">Loading corporate actions...</div>
          )}

          {!corporateActionsLoading && corporateActionsError && (
            <p style={{ color: "#ef6b6b" }}>{corporateActionsError}</p>
          )}

          {!corporateActionsLoading && !corporateActionsError && corporateActions.length === 0 && (
            <div className="loading-card">
              No corporate actions found for this filter.
            </div>
          )}

          {!corporateActionsLoading && !corporateActionsError && corporateActions.length > 0 && (
            <>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>
              Sorted by: <strong style={{ color: "#e2e8f0" }}>
                {corporateActionsSort.startsWith("ANNOUNCEMENT") ? "Announcement Date" : "Effective Date"}
                {" — "}
                {corporateActionsSort.endsWith("OLDEST") ? "Oldest First" : "Newest First"}
              </strong>
            </p>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 12 }}>
              Showing {filteredCorporateActions.length} of {corporateActions.length} corporate actions
            </p>
            </>
          )}
          {!corporateActionsLoading && !corporateActionsError && corporateActions.length > 0 && filteredCorporateActions.length === 0 && (
            <div className="loading-card">
              <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
                No matching corporate actions found.
              </p>
              <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 8px" }}>
                Try changing your company search, verification status, action type, source availability, or effective date range.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setCorporateActionsFilter("ALL");
                  setCorporateActionsTypeFilter("ALL");
                  setCorporateActionsSourceFilter("ALL");
                  setCorporateActionsSearch("");
                  setCorporateActionsFromDate("");
                  setCorporateActionsToDate("");
                  setCorporateActionsSort("EFFECTIVE_NEWEST");
                  setCorporateActionsPage(1);
                  setCorporateActionsPageSize(10);
                }}
                style={{ marginTop: 12 }}
              >
                Clear Filters
              </button>
            </div>
          )}
          {!corporateActionsLoading && !corporateActionsError && filteredCorporateActions.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="portfolio-table corporate-actions-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Action</th>
                    <th>Ratio</th>
                    <th>Announcement</th>
                    <th>Record Date</th>
                    <th>Effective Date</th>
                    <th>Status</th>
                    <th>Sources</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCorporateActions.map((action) => (
                    <Fragment key={action.id}>
                      <tr>
                      <td>{action.symbol}</td>
                      <td>
                        {action.actionType === "BONUS"
                          ? "Bonus Issue"
                          : action.actionType === "STOCK_SPLIT"
                            ? "Stock Split"
                            : action.actionType}
                      </td>
                      <td>
                        {action.ratioNumerator}:{action.ratioDenominator}
                      </td>
                      <td>
                        {action.announcementDate
                          ? new Date(action.announcementDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
                          : "—"}
                      </td>
                      <td>
                        {action.recordDate
                          ? new Date(action.recordDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
                          : "—"}
                      </td>
                      <td>
                        {action.effectiveDate
                          ? new Date(action.effectiveDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
                          : "—"}
                      </td>
                      <td>
                        <span style={{
                          display: "inline-block",
                          padding: "5px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.4,
                          color:
                            String(action.verificationStatus).toUpperCase() === "VERIFIED"
                              ? "#86efac"
                              : String(action.verificationStatus).toUpperCase() === "REJECTED"
                                ? "#fca5a5"
                                : "#fbbf24",
                          background:
                            String(action.verificationStatus).toUpperCase() === "VERIFIED"
                              ? "rgba(34,197,94,0.12)"
                              : String(action.verificationStatus).toUpperCase() === "REJECTED"
                                ? "rgba(239,68,68,0.12)"
                                : "rgba(251,191,36,0.12)",
                          border:
                            String(action.verificationStatus).toUpperCase() === "VERIFIED"
                              ? "1px solid rgba(34,197,94,0.3)"
                              : String(action.verificationStatus).toUpperCase() === "REJECTED"
                                ? "1px solid rgba(239,68,68,0.3)"
                                : "1px solid rgba(251,191,36,0.3)"
                        }}>
                          {String(action.verificationStatus || "UNKNOWN").toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const sourceLinks = String(action.sourceUrl || "").split(/\s+/).filter(Boolean);
                          return (
                            <>
                              <div style={{ marginBottom: 6, fontSize: 12 }}>
                                {action.sourceName || "Source name unavailable"}
                              </div>
                              <span style={{ display: "inline-block", marginBottom: 7, padding: "3px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600, color: sourceLinks.length ? "#86efac" : "#fca5a5", background: sourceLinks.length ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
                                {sourceLinks.length ? `${sourceLinks.length} SOURCE LINK${sourceLinks.length === 1 ? "" : "S"} AVAILABLE` : "SOURCE MISSING"}
                              </span>
                              {sourceLinks.map((url, index) => (
                                <div key={`${action.id}-source-${index}`}>
                                  <a href={url} target="_blank" rel="noreferrer">View Source {index + 1}</a>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setExpandedCorporateActionIds(
                            expandedCorporateActionIds.includes(action.id) ? expandedCorporateActionIds.filter((id) => id !== action.id) : [...expandedCorporateActionIds, action.id]
                          )}
                        >
                          {expandedCorporateActionIds.includes(action.id) ? "Hide Details" : "View Details"}
                        </button>
                      </td>
                    </tr>
                      {expandedCorporateActionIds.includes(action.id) && (
                        <tr>
                          <td colSpan={9} style={{ padding: 0 }}>
                            <div style={{
                              padding: 18,
                              margin: 8,
                              borderRadius: 10,
                              background: "rgba(30, 41, 59, 0.65)",
                              border: "1px solid #334155"
                            }}>
                              <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>
                                Corporate Action Details — {action.symbol}
                              </h3>
                              <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                                gap: 14
                              }}>
                                <div>
                                  <strong>Action Type</strong>
                                  <p>{action.actionType === "BONUS" ? "Bonus Issue" : action.actionType === "STOCK_SPLIT" ? "Stock Split" : action.actionType}</p>
                                </div>
                                <div>
                                  <strong>Ratio</strong>
                                  <p>{action.ratioNumerator}:{action.ratioDenominator}</p>
                                </div>
                                <div>
                                  <strong>Announcement Date</strong>
                                  <p>{action.announcementDate ? new Date(action.announcementDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</p>
                                </div>
                                <div>
                                  <strong>Record Date</strong>
                                  <p>{action.recordDate ? new Date(action.recordDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</p>
                                </div>
                                <div>
                                  <strong>Effective Date</strong>
                                  <p>{action.effectiveDate ? new Date(action.effectiveDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</p>
                                </div>
                                <div>
                                  <strong>Verification Status</strong>
                                  <p>{String(action.verificationStatus || "UNKNOWN").toUpperCase()}</p>
                                </div>
                              </div>
                              {String(action.verificationStatus).toUpperCase() === "PENDING" && (
                                <div style={{ marginTop: 18, padding: 14, borderRadius: 9, border: "1px solid #475569", background: "rgba(15, 23, 42, 0.55)" }}>
                                  <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Administrator Verification</h4>
                                  {adminUser?.role === "ADMIN" ? (
                                    <>
                                      <p style={{ color: "#fbbf24", fontSize: 12 }}>Check the original company and exchange disclosures before making a decision.</p>
                                      <textarea
                                        value={adminReviewNotes[action.id] || ""}
                                        onChange={(event) => setAdminReviewNotes((previous) => ({ ...previous, [action.id]: event.target.value }))}
                                        rows={3}
                                        maxLength={1000}
                                        placeholder="Review findings (10?1000 characters)"
                                        style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 7, resize: "vertical", marginBottom: 10 }}
                                      />
                                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                        <button type="button" className="primary-button" disabled={adminReviewBusyId === action.id} onClick={() => handleCorporateActionReview(action, "VERIFIED")}>
                                          {adminReviewBusyId === action.id ? "Processing..." : "Verify Action"}
                                        </button>
                                        <button type="button" className="secondary-button" disabled={adminReviewBusyId === action.id} onClick={() => handleCorporateActionReview(action, "REJECTED")}>
                                          Reject Action
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Administrator login is required to review this pending action.</p>
                                  )}
                                </div>
                              )}

                              <div style={{ marginTop: 12 }}>
                                <strong>Source Name</strong>
                                <p>{action.sourceName || "Source name unavailable"}</p>
                                <strong>Original Source Links</strong>
                                {String(action.sourceUrl || "").split(/\s+/).filter(Boolean).map((url, index) => (
                                  <p key={`${action.id}-detail-source-${index}`} style={{ margin: "6px 0" }}>
                                    <a href={url} target="_blank" rel="noreferrer">
                                      View Original Source {index + 1}
                                    </a>
                                  </p>
                                ))}
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ marginTop: 12 }}
                                  onClick={async () => {
                                    const details = [
                                      `Company: ${action.symbol}`,
                                      `Action Type: ${action.actionType}`,
                                      `Ratio: ${action.ratioNumerator}:${action.ratioDenominator}`,
                                      `Announcement Date: ${action.announcementDate ? new Date(action.announcementDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}`,
                                      `Record Date: ${action.recordDate ? new Date(action.recordDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}`,
                                      `Effective Date: ${action.effectiveDate ? new Date(action.effectiveDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}`,
                                      `Verification Status: ${action.verificationStatus || "UNKNOWN"}`,
                                      `Source Name: ${action.sourceName || "Unavailable"}`,
                                      `Source URLs: ${String(action.sourceUrl || "").split(/\s+/).filter(Boolean).join(", ") || "Unavailable"}`
                                    ].join("\n");
                                    try {
                                      await navigator.clipboard.writeText(details);
                                      setCopiedCorporateActionId(action.id);
                                      window.setTimeout(() => setCopiedCorporateActionId(null), 2000);
                                    } catch (error) {
                                      window.alert("Unable to copy details. Please check clipboard permissions.");
                                    }
                                  }}
                                >
                                  Copy Action Details
                                </button>
                                {copiedCorporateActionId === action.id && (
                                  <p style={{ color: "#22c55e", fontSize: 13, margin: "8px 0 0" }}>
                                    Copied successfully!
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!corporateActionsLoading && !corporateActionsError && filteredCorporateActions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#9ca3af", fontSize: 13 }}>Rows per page</span>
                <select
                  value={corporateActionsPageSize}
                  onChange={(event) => { setCorporateActionsPageSize(Number(event.target.value)); setCorporateActionsPage(1); }}
                  style={{ padding: "8px 10px", borderRadius: 8, background: "#111827", color: "#ffffff", border: "1px solid #3a4558" }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="secondary-button" onClick={() => { setExpandedCorporateActionIds([]); setCorporateActionsPage((page) => Math.max(1, page - 1)); }} disabled={corporateActionsPage <= 1}>Previous</button>
                <span style={{ color: "#9ca3af", fontSize: 13 }}>Page {corporateActionsPage} of {corporateActionsTotalPages}</span>
                <button type="button" className="secondary-button" onClick={() => { setExpandedCorporateActionIds([]); setCorporateActionsPage((page) => Math.min(corporateActionsTotalPages, page + 1)); }} disabled={corporateActionsPage >= corporateActionsTotalPages}>Next</button>
              </div>
            </div>
          )}
        </section>

        <div className="section-label" style={{ marginTop: 30 }}>
          COMPANY ANALYSIS - {selected}
        </div>

        <DataPanel title="Company Profile" data={details.profile} kind="profile" />
        <DataPanel title="Company Intelligence" data={details.intelligence} kind="intelligence" />
        <DataPanel title="Technical Analysis" data={details.technical} kind="technical" />
        <DataPanel title="AI Prediction" data={details.prediction} kind="prediction" />
        <DataPanel title="Financial Analysis" data={{ ...details.financial, fundamentals: details.fundamentals }} kind="financial" />
        <DataPanel title="Risk Analysis" data={details.risk} kind="risk" />

        <section className="section" id="news">
          <h2>Market News &amp; Sentiment</h2>
          <DataStatus data={news} />

          <button
            type="button"
            className="primary-button"
            style={{ marginTop: 12, marginBottom: 18, border: 0, cursor: "pointer" }}
            onClick={loadSentiment}
            disabled={sentimentLoading}
          >
            {sentimentLoading ? "Analyzing..." : "Analyze Market Sentiment"}
          </button>


          <button
            type="button"
            className="primary-button"
            style={{
              marginTop: 12,
              marginBottom: 18,
              marginLeft: 10,
              border: 0,
              cursor: "pointer",
            }}
            onClick={refreshNews}
            disabled={sentimentLoading}
          >
            {sentimentLoading ? "Refreshing..." : "Refresh News"}
          </button>


          {sentimentError && (
            <p style={{ color: "#fb7185" }}>{sentimentError}</p>
          )}

          {sentiment?.analysis && (
            <>
              <DataStatus data={sentiment} />
              <div className="stats-grid">
                <Metric
                  label="Overall Sentiment"
                  value={sentiment.analysis.overallSentiment}
                />
                <Metric
                  label="Average Score"
                  value={sentiment.analysis.averageScore}
                />
                <Metric
                  label="Total News"
                  value={sentiment.analysis.totalNews}
                />
                <Metric
                  label="Positive"
                  value={sentiment.analysis.positive}
                  color="#34d399"
                />
                <Metric
                  label="Neutral"
                  value={sentiment.analysis.neutral}
                />
                <Metric
                  label="Negative"
                  value={sentiment.analysis.negative}
                  color="#fb7185"
                />
              </div>
            </>
          )}

          <h3 style={{ marginTop: 24 }}>Latest Market Headlines</h3>

          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            margin: "14px 0 18px"
          }}>
            <button
              type="button"
              className="primary-button"
              style={{
                border: 0,
                cursor: "pointer",
                opacity: newsFilter === "market" ? 1 : 0.65
              }}
              onClick={() => setNewsFilter("market")}
            >
              All Market News ({newsItems.length})
            </button>

            <button
              type="button"
              className="primary-button"
              style={{
                border: 0,
                cursor: "pointer",
                opacity: newsFilter === "company" ? 1 : 0.65
              }}
              onClick={() => setNewsFilter("company")}
            >
              {selected} News ({companyNewsItems.length})
            </button>
          </div>

          {displayedNews.length === 0 ? (
            <p className="data-status">
              No matching headlines were found for {selectedCompanyName}
              in the current news feed. Try All Market News or refresh the
              feed. This does not mean the company has no news.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {displayedNews.map((item, index) => (
                <article
                  key={item.id || item.url || index}
                  style={{
                    padding: 16,
                    border: "1px solid #263a52",
                    borderRadius: 10,
                    background: "#111f33",
                    overflowWrap: "anywhere"
                  }}
                >
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 10,
                    color: "#94a3b8",
                    fontSize: 12
                  }}>
                    <span>{item.source || "News source"}</span>
                    <span>-</span>
                    <span>{item.category || "Market News"}</span>
                    <span>-</span>
                    <span>{item.time || ""}</span>
                  </div>

                  <div style={{
                    fontWeight: 600,
                    lineHeight: 1.6,
                    marginBottom: 10
                  }}>
                    {item.title || "Untitled headline"}
                  </div>

                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "center",
                    fontSize: 13
                  }}>
                    <span style={{
                      color: item.sentiment === "Positive"
                        ? "#34d399"
                        : item.sentiment === "Negative"
                          ? "#fb7185"
                          : "#cbd5e1"
                    }}>
                      {item.sentiment || "Sentiment unavailable"}
                    </span>

                    {item.sentimentScore != null && (
                      <span className="data-status">
                        Estimated score: {item.sentimentScore}
                      </span>
                    )}

                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#38bdf8" }}
                      >
                        Read article
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <p className="data-status" style={{ marginTop: 14 }}>
            Sentiment is estimated from headline keywords; it is not a
            validated financial sentiment model.
          </p>
        </section>

        <section className="section">
          <h2>All Tracked Stocks</h2>
          <div className="company-grid">
            {stocks.map((stock) => (
              <button
                type="button"
                className="company-card"
                key={stock.symbol}
                onClick={() => setSelected(stock.symbol)}
              >
                <strong>{stock.name}</strong>
                <span>{stock.symbol}</span>
                <strong>{formatPrice(stock.price)}</strong>
                <Change value={stock.change} percent={stock.changePercent} />
                <span className="data-status">{stock.dataStatus}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <strong>StockAI</strong>
          <p>
            Informational analysis only. Verify market data independently
            before investing.
          </p>
          <p className="data-status">
            Demo predictions are not validated investment recommendations.
          </p>
        </div>
      </footer>
    </div>
  );
}
