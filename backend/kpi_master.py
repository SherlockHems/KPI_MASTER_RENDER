import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def generate_mock_data():
    date_range = pd.date_range(start='2023-01-01', end='2023-12-31', freq='D')
    sales_people = ['Alice', 'Bob', 'Charlie', 'David']
    clients = ['Client A', 'Client B', 'Client C', 'Client D', 'Client E']
    funds = ['Fund X', 'Fund Y', 'Fund Z']

    data = []
    for date in date_range:
        for sales_person in sales_people:
            for client in clients:
                for fund in funds:
                    income = np.random.randint(1000, 10000)
                    data.append({
                        'date': date,
                        'sales_person': sales_person,
                        'client': client,
                        'fund': fund,
                        'income': income
                    })

    return pd.DataFrame(data)


def get_dashboard_data(df):
    total_income = df['income'].sum()
    top_sales_person = df.groupby('sales_person')['income'].sum().idxmax()
    top_client = df.groupby('client')['income'].sum().idxmax()
    top_fund = df.groupby('fund')['income'].sum().idxmax()

    return {
        'total_income': total_income,
        'top_sales_person': top_sales_person,
        'top_client': top_client,
        'top_fund': top_fund
    }


def get_sales_data(df):
    return df.groupby(['date', 'sales_person'])['income'].sum().unstack().to_dict()


def get_clients_data(df):
    return df.groupby(['date', 'client'])['income'].sum().unstack().to_dict()


def get_funds_data(df):
    return df.groupby(['date', 'fund'])['income'].sum().unstack().to_dict()


def get_forecast_data(df):
    last_date = df['date'].max()
    forecast_dates = pd.date_range(start=last_date + timedelta(days=1), periods=30)

    simple_forecast = np.random.randint(100000, 200000, size=30)
    complex_forecast = np.random.randint(150000, 250000, size=30)

    return {
        'dates': forecast_dates.strftime('%Y-%m-%d').tolist(),
        'simple_forecast': simple_forecast.tolist(),
        'complex_forecast': complex_forecast.tolist()
    }


# Generate mock data
df = generate_mock_data()

# Example usage
dashboard_data = get_dashboard_data(df)
sales_data = get_sales_data(df)
clients_data = get_clients_data(df)
funds_data = get_funds_data(df)
forecast_data = get_forecast_data(df)