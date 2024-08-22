from flask import Flask, jsonify
from flask_cors import CORS
import logging
import datetime
import pandas as pd

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)

# Import functions from kpi_master_v1_07
try:
    from kpi_master_v1_07 import (
        load_initial_holdings,
        load_trades,
        load_product_info,
        load_client_sales,
        calculate_daily_holdings,
        calculate_daily_income,
        calculate_cumulative_income,
        show_income_statistics,
        generate_forecasts,
        generate_sales_person_breakdowns,
        generate_client_breakdowns
    )

    kpi_import_error = None
except ImportError as e:
    kpi_import_error = str(e)
    logging.error(f"Error importing from kpi_master_v1_07: {e}")


def prepare_sales_data(daily_income, client_sales):


# ... [keep the existing code for prepare_sales_data]

def load_and_process_data():
    if kpi_import_error:
        return {"error": f"Failed to import necessary functions: {kpi_import_error}"}

    start_date = datetime.date(2023, 12, 31)
    end_date = datetime.date(2024, 6, 30)

    try:
        initial_holdings = load_initial_holdings('data/2023DEC.csv')
        trades = load_trades('data/TRADES_LOG.csv')
        product_info = load_product_info('data/PRODUCT_INFO.csv')
        client_sales = load_client_sales('data/CLIENT_LIST.csv')

        daily_holdings = calculate_daily_holdings(initial_holdings, trades, start_date, end_date)
        daily_income, sales_income, client_income = calculate_daily_income(daily_holdings, product_info, client_sales)

        cumulative_sales_income = calculate_cumulative_income(sales_income)
        cumulative_client_income = calculate_cumulative_income(client_income)

        client_stats, fund_stats, sales_stats = show_income_statistics(daily_income, sales_income, client_income,
                                                                       daily_holdings, product_info)

        forecasts = generate_forecasts(daily_income, product_info, daily_holdings, trades, end_date)

        sales_person_breakdowns = generate_sales_person_breakdowns(daily_income, client_sales)
        client_breakdowns = generate_client_breakdowns(daily_income)

        return {
            'daily_income': daily_income,
            'sales_income': sales_income,
            'client_income': client_income,
            'client_sales': client_sales,
            'cumulative_sales_income': cumulative_sales_income,
            'cumulative_client_income': cumulative_client_income,
            'client_stats': client_stats,
            'fund_stats': fund_stats,
            'sales_stats': sales_stats,
            'forecasts': forecasts,
            'daily_holdings': daily_holdings,
            'sales_person_breakdowns': sales_person_breakdowns,
            'client_breakdowns': client_breakdowns
        }
    except Exception as e:
        logging.error(f"Error in load_and_process_data: {e}")
        return {"error": str(e)}


# Load and process data
data = load_and_process_data()

# Prepare sales data if no error occurred
if 'error' not in data:
    sales_data = prepare_sales_data(data['daily_income'], data['client_sales'])
else:
    sales_data = {"error": data['error']}


@app.route('/')
def home():
    app.logger.info("Home route accessed")
    return "Welcome to the KPI Master API"


@app.route('/api/sales')
def sales():
    return jsonify(sales_data)


@app.route('/api/dashboard')
def dashboard():
    if 'error' in data:
        return jsonify({"error": data['error']})

    return jsonify({
        'total_income': sum(sum(client.values()) for client in data['daily_income'].values()),
        'total_clients': len(set(client for day in data['daily_income'].values() for client in day.keys())),
        'total_funds': len(
            set(fund for day in data['daily_income'].values() for client in day.values() for fund in client.keys())),
        'total_sales': len(set(data['client_sales'].values())),
        'income_trend': [{'date': date.isoformat(), 'income': sum(client.values())} for date, client in
                         data['daily_income'].items()]
    })


@app.route('/api/clients')
def clients():
    if 'error' in data:
        return jsonify({"error": data['error']})

    return jsonify({
        'client_income': {date.isoformat(): {client: sum(funds.values()) for client, funds in clients.items()}
                          for date, clients in data['daily_income'].items()},
        'client_stats': data['client_stats'].to_dict()
    })


@app.route('/api/funds')
def funds():
    if 'error' in data:
        return jsonify({"error": data['error']})

    fund_income = {}
    for date, clients in data['daily_income'].items():
        fund_income[date.isoformat()] = {}
        for client, funds in clients.items():
            for fund, income in funds.items():
                if fund not in fund_income[date.isoformat()]:
                    fund_income[date.isoformat()][fund] = 0
                fund_income[date.isoformat()][fund] += income

    return jsonify({
        'fund_income': fund_income,
        'fund_stats': data['fund_stats'].to_dict()
    })


@app.route('/api/forecast')
def forecast():
    if 'error' in data:
        return jsonify({"error": data['error']})
    return jsonify(data['forecasts'])


if __name__ == '__main__':
    app.run(debug=True)