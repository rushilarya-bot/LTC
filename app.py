import io
import csv
from datetime import datetime
from flask import Flask, render_template, request, jsonify, Response, send_file
import yfinance as yf
import pandas as pd

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/preview", methods=["POST"])
def preview():
    data = request.get_json() or {}
    symbol = data.get("symbol", "").strip().upper()
    start_date = data.get("start_date", "").strip()
    end_date = data.get("end_date", "").strip()
    interval = data.get("interval", "1d").strip()

    if not symbol:
        return jsonify({"error": "Symbol is required"}), 400
    if not start_date or not end_date:
        return jsonify({"error": "Start date and End date are required"}), 400

    try:
        # Validate dates
        d_start = datetime.strptime(start_date, "%Y-%m-%d")
        d_end = datetime.strptime(end_date, "%Y-%m-%d")
        if d_start > d_end:
            return jsonify({"error": "Start date cannot be after End date"}), 400

        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start_date, end=end_date, interval=interval, auto_adjust=False)

        if df.empty:
            return jsonify({"error": f"No data found for symbol '{symbol}' in the specified date range. Please check the ticker symbol or date range."}), 404

        # Clean index / dates
        df = df.reset_index()
        
        # Format Date/Datetime column
        date_col = "Date" if "Date" in df.columns else df.columns[0]
        if pd.api.types.is_datetime64_any_dtype(df[date_col]):
            df[date_col] = df[date_col].dt.strftime("%Y-%m-%d")

        # Standard OHLC columns selection if available
        expected_cols = [date_col, "Open", "High", "Low", "Close", "Adj Close", "Volume"]
        available_cols = [c for c in expected_cols if c in df.columns]
        # Any remaining columns
        other_cols = [c for c in df.columns if c not in available_cols]
        final_cols = available_cols + other_cols

        df_subset = df[final_cols]

        # Prepare summary stats
        summary = {
            "symbol": symbol,
            "total_rows": len(df_subset),
            "start": str(df_subset[date_col].iloc[0]),
            "end": str(df_subset[date_col].iloc[-1]),
            "min_low": float(df_subset["Low"].min()) if "Low" in df_subset else None,
            "max_high": float(df_subset["High"].max()) if "High" in df_subset else None,
            "latest_close": float(df_subset["Close"].iloc[-1]) if "Close" in df_subset else None,
        }

        # Provide up to 50 preview rows
        preview_rows = df_subset.head(50).to_dict(orient="records")

        return jsonify({
            "columns": final_cols,
            "rows": preview_rows,
            "summary": summary
        })

    except Exception as e:
        return jsonify({"error": f"Failed to fetch data: {str(e)}"}), 500


@app.route("/api/download", methods=["GET"])
def download():
    symbol = request.args.get("symbol", "").strip().upper()
    start_date = request.args.get("start_date", "").strip()
    end_date = request.args.get("end_date", "").strip()
    interval = request.args.get("interval", "1d").strip()

    if not symbol or not start_date or not end_date:
        return "Symbol, start date, and end date are required", 400

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start_date, end=end_date, interval=interval, auto_adjust=False)

        if df.empty:
            return f"No data found for symbol {symbol}", 404

        df = df.reset_index()
        date_col = "Date" if "Date" in df.columns else df.columns[0]
        if pd.api.types.is_datetime64_any_dtype(df[date_col]):
            df[date_col] = df[date_col].dt.strftime("%Y-%m-%d")

        expected_cols = [date_col, "Open", "High", "Low", "Close", "Adj Close", "Volume"]
        available_cols = [c for c in expected_cols if c in df.columns]
        other_cols = [c for c in df.columns if c not in available_cols]
        df = df[available_cols + other_cols]

        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_output = csv_buffer.getvalue()

        filename = f"{symbol}_{start_date}_to_{end_date}_OHLC.csv"
        return Response(
            csv_output,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        return f"Error exporting CSV: {str(e)}", 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
