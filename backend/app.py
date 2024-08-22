from flask import Flask, jsonify
from flask_cors import CORS
import logging
import datetime
import pandas as pd

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)

# Import only the necessary functions from kpi_master_v1_07
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


def prepare_sales_data(daily_income, client_sales):
    sales_person_income = {}
    for date, clients in daily_income.items():
        for client, funds in clients.items():
            sales_person = client_sales.get(client, "Unknown")
            if sales_person not in sales_person_income:
                sales_person_income[sales_person] = {}
            if date not in sales_person_income[sales_person]:
                sales_person_income[sales_person][date] = 0
            sales_person_income[sales_person][date] += sum(funds.values())

    sales_data = {
        'salesPersons': [],
        'dailyContribution': [],
        'individualPerformance': {}
    }

    all_dates = sorted(set(date for sp_data in sales_person_income.values() for date in sp_data.keys()))

    for date in all_dates:
        daily_data = {'date': date.isoformat()}
        for sales_person, income_data in sales_person_income.items():
            daily_data[sales_person] = income_data.get(date, 0)
        sales_data['dailyContribution'].append(daily_data)

    for sales_person, income_data in sales_person_income.items():
        cumulative_income = sum(income_data.values())
        sales_data['individualPerformance'][sales_person] = [
            {'date': date.isoformat(), 'income': income}
            for date, income in sorted(income_data.items())
        ]

        sales_data['salesPersons'].append({
            'name': sales_person,
            'cumulativeIncome': cumulative_income
        })

    return sales_data


def load_and_process_data():
    start_date = datetime.date(2023, 12, 31)
    end_date = datetime.date(2024, 6, 30)

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


# Load and process data
data = load_and_process_data()

# Prepare sales data
sales_data = prepare_sales_data(data['daily_income'], data['client_sales'])


@app.route('/')
def home():
    app.logger.info("Home route accessed")
    return "Welcome to the KPI Master API"


@app.route('/api/sales')
def sales():
    return jsonify(sales_data)


@app.route('/api/dashboard')
def dashboard():
    # Prepare and return dashboard data
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
    # Prepare and return client data
    return jsonify({
        'client_income': {date.isoformat(): {client: sum(funds.values()) for client, funds in clients.items()}
                          for date, clients in data['daily_income'].items()},
        'client_stats': data['client_stats'].to_dict()
    })


@app.route('/api/funds')
def funds():
    # Prepare and return fund data
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
    return jsonify(data['forecasts'])


if __name__ == '__main__':
    app.run(debug=True)