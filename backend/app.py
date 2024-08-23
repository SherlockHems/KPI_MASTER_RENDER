from flask import Flask, jsonify
from flask_cors import CORS
import logging
import datetime
import pandas as pd
import traceback
from collections import Counter
from kpi_master_v1_07 import (
    load_initial_holdings, load_trades, load_product_info, load_client_sales,
    calculate_daily_holdings, calculate_daily_income, calculate_cumulative_income,
    show_income_statistics, generate_forecasts, generate_sales_person_breakdowns,
    generate_client_breakdowns
)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

logger.info("Starting data loading process")

try:
    # Load data
    start_date = datetime.date(2023, 12, 31)
    end_date = datetime.date(2024, 6, 30)
    initial_holdings = load_initial_holdings('data/2023DEC.csv')
    logger.info("Initial holdings loaded successfully")
    trades = load_trades('data/TRADES_LOG.csv')
    logger.info("Trades loaded successfully")
    product_info = load_product_info('data/PRODUCT_INFO.csv')
    logger.info("Product info loaded successfully")
    client_sales = load_client_sales('data/CLIENT_LIST.csv')
    logger.info("Client sales info loaded successfully")
    logger.debug(f"client_sales structure: {type(client_sales)}")
    logger.debug(f"client_sales sample: {list(client_sales.items())[:5] if isinstance(client_sales, dict) else client_sales[:5]}")

    # Calculate data
    logger.info("Starting data processing")
    daily_holdings = calculate_daily_holdings(initial_holdings, trades, start_date, end_date)
    daily_income, sales_income, client_income = calculate_daily_income(daily_holdings, product_info, client_sales)
    cumulative_sales_income = calculate_cumulative_income(sales_income)
    cumulative_client_income = calculate_cumulative_income(client_income)
    client_stats, fund_stats, sales_stats = show_income_statistics(daily_income, sales_income, client_income, daily_holdings, product_info)
    forecasts = generate_forecasts(daily_income, product_info, daily_holdings, trades, end_date)
    sales_person_breakdowns = generate_sales_person_breakdowns(daily_income, client_sales)
    client_breakdowns = generate_client_breakdowns(daily_income)
    logger.info("Data processing completed successfully")
except Exception as e:
    logger.error(f"Error during data loading or processing: {str(e)}")
    logger.error(traceback.format_exc())

def calculate_province_counts(client_sales):
    province_counts = Counter()
    if isinstance(client_sales, dict):
        for client, data in client_sales.items():
            if isinstance(data, dict):
                province = data.get('PROVINCE', '-')
                if province != '-':
                    province_counts[province] += 1
            else:
                logger.warning(f"Unexpected data type for client {client}: {type(data)}")
    else:
        logger.warning(f"Unexpected type for client_sales: {type(client_sales)}")
    return dict(province_counts)

@app.route('/')
def home():
    return "KPI Master API is running"

@app.route('/api/dashboard')
def get_dashboard():
    try:
        logger.info("Processing dashboard data")
        total_income = sum(sum(client.values()) for client in daily_income[max(daily_income.keys())].values())
        total_clients = len(set(client for day in daily_income.values() for client in day.keys()))
        total_funds = len(set(fund for day in daily_income.values() for client in day.values() for fund in client.keys()))
        total_sales = len(set(sales_income[max(sales_income.keys())].keys()))

        income_trend = [{'date': date.isoformat(), 'income': sum(sum(client.values()) for client in clients.values())}
                        for date, clients in daily_income.items()]

        dashboard_data = {
            'total_income': total_income,
            'total_clients': total_clients,
            'total_funds': total_funds,
            'total_sales': total_sales,
            'income_trend': income_trend
        }

        logger.info("Dashboard data processed successfully")
        return jsonify(dashboard_data)
    except Exception as e:
        logger.error(f"Error processing dashboard data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'An error occurred while processing dashboard data: {str(e)}'}), 500

@app.route('/api/sales')
def get_sales():
    try:
        logger.info("Processing sales data")
        sales_data = {
            'salesPersons': [],
            'dailyContribution': [],
            'individualPerformance': {}
        }

        for date in sales_income.keys():
            daily_data = {'date': date.isoformat()}
            for sales_person in sales_income[date].keys():
                daily_data[sales_person] = sales_income[date][sales_person]
            sales_data['dailyContribution'].append(daily_data)

        for sales_person in set(person for daily in sales_income.values() for person in daily.keys()):
            sales_data['individualPerformance'][sales_person] = []
            cumulative_income = 0
            all_clients = set()
            all_funds = set()

            for date in sorted(sales_income.keys()):
                if sales_person in sales_income[date]:
                    cumulative_income += sales_income[date][sales_person]

                    client_data = sales_person_breakdowns[date][sales_person]['clients']
                    fund_data = sales_person_breakdowns[date][sales_person]['funds']

                    all_clients.update(client_data.keys())
                    all_funds.update(fund_data.keys())

                    sales_data['individualPerformance'][sales_person].append({
                        'date': date.isoformat(),
                        'income': cumulative_income,
                        'clients': client_data,
                        'funds': fund_data
                    })

            sales_data['salesPersons'].append({
                'name': sales_person,
                'cumulativeIncome': cumulative_income,
                'totalClients': len(all_clients),
                'totalFunds': len(all_funds),
                'topClients': sorted(all_clients)[:10],
                'topFunds': sorted(all_funds)[:10]
            })

        logger.info("Sales data processed successfully")
        return jsonify(sales_data)
    except Exception as e:
        logger.error(f"Error processing sales data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'An error occurred while processing sales data: {str(e)}'}), 500

@app.route('/api/clients', methods=['GET'])
def get_clients():
    try:
        logger.info("Processing clients data")
        clients_data = []

        logger.debug(f"client_sales type: {type(client_sales)}")
        logger.debug(f"client_sales sample: {list(client_sales.items())[:5] if isinstance(client_sales, dict) else client_sales[:5]}")
        logger.debug(f"daily_income type: {type(daily_income)}")
        logger.debug(f"daily_income sample: {list(daily_income.items())[:5] if isinstance(daily_income, dict) else daily_income[:5]}")

        if not isinstance(client_sales, dict):
            raise ValueError(f"client_sales is not a dictionary. Type: {type(client_sales)}")

        for client, data in client_sales.items():
            if not isinstance(data, dict):
                logger.warning(f"Skipping client {client} due to unexpected data type: {type(data)}")
                continue

            logger.debug(f"Processing client: {client}, Sales Person: {data.get('SALES', 'Unknown')}")
            client_value = sum(sum(daily_income.get(date, {}).get(client, {}).values()) for date in daily_income)
            logger.debug(f"Client value: {client_value}")

            sales_person = data.get('SALES', 'Unknown')
            found = False
            for sales_data in clients_data:
                if sales_data["name"] == sales_person:
                    sales_data["clients"].append({
                        "name": client,
                        "value": client_value,
                        "province": data.get('PROVINCE', 'Unknown')
                    })
                    sales_data["clientCount"] += 1
                    sales_data["totalClientValue"] += client_value
                    found = True
                    break

            if not found:
                clients_data.append({
                    "name": sales_person,
                    "clientCount": 1,
                    "totalClientValue": client_value,
                    "clients": [{
                        "name": client,
                        "value": client_value,
                        "province": data.get('PROVINCE', 'Unknown')
                    }]
                })

        logger.info(f"Processed data for {len(clients_data)} sales persons")
        logger.debug(f"Clients data sample: {clients_data[:2]}")

        return jsonify(clients_data)
    except Exception as e:
        logger.error(f"Error processing clients data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'An error occurred while processing clients data: {str(e)}'}), 500


@app.route('/api/province-counts', methods=['GET'])
def get_province_counts():
    try:
        logger.info("Processing province counts")
        logger.debug(f"client_sales type: {type(client_sales)}")
        logger.debug(
            f"client_sales sample: {list(client_sales.items())[:5] if isinstance(client_sales, dict) else client_sales[:5]}")

        province_counts = calculate_province_counts(client_sales)
        # Transform the data to include all provinces, even those with zero counts
        all_provinces = [
            "安徽", "北京", "重庆", "福建", "甘肃", "广东", "广西", "贵州", "海南", "河北", "河南",
            "黑龙江", "湖北", "湖南", "吉林", "江苏", "江西", "辽宁", "内蒙古", "宁夏", "青海",
            "山东", "山西", "陕西", "上海", "四川", "天津", "西藏", "新疆", "云南", "浙江"
        ]
        transformed_counts = {province: province_counts.get(province, 0) for province in all_provinces}
        logger.debug(f"Province counts: {transformed_counts}")
        return jsonify(transformed_counts)
    except Exception as e:
        logger.error(f"Error processing province counts: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'An error occurred while processing province counts: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)