from flask import Flask, jsonify
from flask_cors import CORS
import kpi_master_v1_07 as kpi
import datetime
import logging
import os

from backend import kpi_master_v1_07

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)

@app.route('/')
def home():
    app.logger.info("Home route accessed")
    return "Welcome to the KPI Master API"

@app.route('/api/dashboard')
def dashboard():
    return jsonify(kpi_master_v1_07.dashboard_data)

@app.route('/api/sales')
def sales():
    start_date = datetime.date(2023, 12, 31)
    end_date = datetime.date(2024, 6, 30)

    initial_holdings = kpi.load_initial_holdings('data/2023DEC.csv')
    trades = kpi.load_trades('data/TRADES_LOG.csv')
    product_info = kpi.load_product_info('data/PRODUCT_INFO.csv')
    client_sales = kpi.load_client_sales('data/CLIENT_LIST.csv')

    daily_holdings = kpi.calculate_daily_holdings(initial_holdings, trades, start_date, end_date)
    daily_income, sales_income, client_income = kpi.calculate_daily_income(daily_holdings, product_info, client_sales)

    # Convert datetime.date objects to ISO format strings
    sales_income_serializable = {date.isoformat(): data for date, data in sales_income.items()}
    client_income_serializable = {date.isoformat(): data for date, data in client_income.items()}

    return jsonify({
        'daily_income': daily_income,
        'sales_income': sales_income_serializable,
        'client_income': client_income_serializable
    })


@app.route('/api/clients')
def clients():
    return jsonify(kpi_master_v1_07.clients_data)

@app.route('/api/funds')
def funds():
    return jsonify(kpi_master_v1_07.funds_data)

@app.route('/api/forecast')
def forecast():
    return jsonify(kpi_master_v1_07.forecast_data)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)