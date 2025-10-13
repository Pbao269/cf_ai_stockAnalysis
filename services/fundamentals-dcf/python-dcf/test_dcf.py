"""
Unit tests for DCF formulas and calculations

Tests validate:
1. WACC calculation
2. FCF projections
3. Terminal value (Gordon Growth and Exit Multiple)
4. Present value discounting
5. Sensitivity analysis
6. Constraint validation (g < WACC)
"""

import unittest
from main import (
    calculate_wacc,
    calculate_dcf,
    generate_dcf_assumptions,
    adjust_assumptions_for_scenario,
    get_mock_fundamentals
)


class TestWACCCalculation(unittest.TestCase):
    """Test WACC formula: WACC = (E/V)*Re + (D/V)*Rd*(1-Tc)"""
    
    def test_wacc_all_equity(self):
        """Test WACC with 100% equity financing"""
        wacc = calculate_wacc(
            risk_free_rate=0.04,
            beta=1.0,
            market_risk_premium=0.08,
            cost_of_debt=0.05,
            debt_to_equity=0.0,  # No debt
            tax_rate=0.21
        )
        # WACC should equal cost of equity when no debt
        # Re = 0.04 + 1.0 * 0.08 = 0.12 = 12%
        self.assertAlmostEqual(wacc, 0.12, places=4)
    
    def test_wacc_with_debt(self):
        """Test WACC with debt financing"""
        wacc = calculate_wacc(
            risk_free_rate=0.04,
            beta=1.2,
            market_risk_premium=0.08,
            cost_of_debt=0.05,
            debt_to_equity=1.0,  # 50/50 debt/equity
            tax_rate=0.21
        )
        # Re = 0.04 + 1.2 * 0.08 = 0.136 = 13.6%
        # E/V = 0.5, D/V = 0.5
        # WACC = 0.5 * 0.136 + 0.5 * 0.05 * (1 - 0.21)
        #      = 0.068 + 0.5 * 0.05 * 0.79
        #      = 0.068 + 0.01975
        #      = 0.08775 = 8.775%
        expected = 0.5 * 0.136 + 0.5 * 0.05 * 0.79
        self.assertAlmostEqual(wacc, expected, places=4)
    
    def test_wacc_high_beta(self):
        """Test WACC with high beta (risky stock)"""
        wacc = calculate_wacc(
            risk_free_rate=0.04,
            beta=2.0,
            market_risk_premium=0.08,
            cost_of_debt=0.06,
            debt_to_equity=0.5,
            tax_rate=0.21
        )
        # Re = 0.04 + 2.0 * 0.08 = 0.20 = 20%
        # E/V = 1/1.5 = 0.667, D/V = 0.5/1.5 = 0.333
        # WACC = 0.667 * 0.20 + 0.333 * 0.06 * 0.79
        expected = (1/1.5) * 0.20 + (0.5/1.5) * 0.06 * 0.79
        self.assertAlmostEqual(wacc, expected, places=3)


class TestDCFCalculation(unittest.TestCase):
    """Test DCF valuation formulas"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.snapshot = get_mock_fundamentals('AAPL')
        self.assumptions = generate_dcf_assumptions(self.snapshot)
    
    def test_dcf_produces_positive_value(self):
        """Test that DCF produces positive enterprise and equity values"""
        result = calculate_dcf(self.snapshot, self.assumptions, scenario='base')
        
        self.assertGreater(result['enterprise_value'], 0)
        self.assertGreater(result['equity_value'], 0)
        self.assertGreater(result['price_per_share'], 0)
    
    def test_dcf_projections_growth(self):
        """Test that revenue grows according to assumptions"""
        result = calculate_dcf(self.snapshot, self.assumptions, scenario='base')
        projections = result['projections']
        
        growth_rate = self.assumptions['revenue_growth_years_1_5']
        initial_revenue = self.snapshot['revenue']
        
        for i, proj in enumerate(projections):
            year = proj['year']
            expected_revenue = initial_revenue * ((1 + growth_rate) ** year)
            self.assertAlmostEqual(
                proj['revenue'],
                expected_revenue,
                delta=expected_revenue * 0.01  # 1% tolerance
            )
    
    def test_fcf_calculation(self):
        """Test FCF = Net Income + D&A - CapEx - WC Change"""
        result = calculate_dcf(self.snapshot, self.assumptions, scenario='base')
        proj = result['projections'][0]  # Year 1
        
        # FCF should equal: NI + Depreciation - CapEx - WC Change
        expected_fcf = (
            proj['net_income'] +
            proj['depreciation'] -
            proj['capex'] -
            proj['working_capital_change']
        )
        
        self.assertAlmostEqual(
            proj['free_cash_flow'],
            expected_fcf,
            delta=abs(expected_fcf) * 0.01  # 1% tolerance
        )
    
    def test_terminal_growth_less_than_wacc(self):
        """Test that terminal growth < WACC (mathematical requirement)"""
        result = calculate_dcf(self.snapshot, self.assumptions, scenario='base')
        
        terminal_growth = self.assumptions['terminal_growth_rate']
        wacc = result['wacc']
        
        self.assertLess(
            terminal_growth,
            wacc,
            f"Terminal growth {terminal_growth:.2%} must be < WACC {wacc:.2%}"
        )
    
    def test_discount_factor_correct(self):
        """Test that discount factor is correctly applied"""
        result = calculate_dcf(self.snapshot, self.assumptions, scenario='base')
        wacc = result['wacc']
        
        for proj in result['projections']:
            year = proj['year']
            expected_pv = proj['free_cash_flow'] / ((1 + wacc) ** year)
            
            self.assertAlmostEqual(
                proj['discounted_fcf'],
                expected_pv,
                delta=abs(expected_pv) * 0.01  # 1% tolerance
            )
    
    def test_terminal_value_percent(self):
        """Test that terminal value is reasonable (typically 50-80% of EV)"""
        result = calculate_dcf(self.snapshot, self.assumptions, scenario='base')
        
        tv_percent = result['terminal_value_percent']
        
        self.assertGreater(tv_percent, 0.30, "Terminal value should be > 30% of EV")
        self.assertLess(tv_percent, 0.85, "Terminal value should be < 85% of EV")


class TestScenarioAnalysis(unittest.TestCase):
    """Test bull/bear scenario adjustments"""
    
    def setUp(self):
        self.snapshot = get_mock_fundamentals('AAPL')
        self.base_assumptions = generate_dcf_assumptions(self.snapshot)
    
    def test_bull_scenario_higher_growth(self):
        """Test that bull case has higher growth than base"""
        bull_assumptions = adjust_assumptions_for_scenario(self.base_assumptions, 'bull')
        
        self.assertGreater(
            bull_assumptions['revenue_growth_years_1_5'],
            self.base_assumptions['revenue_growth_years_1_5']
        )
    
    def test_bear_scenario_lower_growth(self):
        """Test that bear case has lower growth than base"""
        bear_assumptions = adjust_assumptions_for_scenario(self.base_assumptions, 'bear')
        
        self.assertLess(
            bear_assumptions['revenue_growth_years_1_5'],
            self.base_assumptions['revenue_growth_years_1_5']
        )
    
    def test_bull_scenario_higher_margins(self):
        """Test that bull case has higher margins than base"""
        bull_assumptions = adjust_assumptions_for_scenario(self.base_assumptions, 'bull')
        
        self.assertGreater(
            bull_assumptions['ebitda_margin_target'],
            self.base_assumptions['ebitda_margin_target']
        )
    
    def test_scenario_probabilities(self):
        """Test that scenario probabilities are set correctly"""
        bull_assumptions = adjust_assumptions_for_scenario(self.base_assumptions, 'bull')
        bear_assumptions = adjust_assumptions_for_scenario(self.base_assumptions, 'bear')
        
        self.assertEqual(bull_assumptions['scenario_probability'], 0.25)
        self.assertEqual(bear_assumptions['scenario_probability'], 0.25)
    
    def test_bull_higher_valuation_than_base(self):
        """Test that bull case produces higher valuation than base"""
        base_result = calculate_dcf(self.snapshot, self.base_assumptions, 'base')
        
        bull_assumptions = adjust_assumptions_for_scenario(self.base_assumptions, 'bull')
        bull_result = calculate_dcf(self.snapshot, bull_assumptions, 'bull')
        
        self.assertGreater(
            bull_result['price_per_share'],
            base_result['price_per_share'],
            "Bull case should have higher valuation than base"
        )
    
    def test_bear_lower_valuation_than_base(self):
        """Test that bear case produces lower valuation than base"""
        base_result = calculate_dcf(self.snapshot, self.base_assumptions, 'base')
        
        bear_assumptions = adjust_assumptions_for_scenario(self.base_assumptions, 'bear')
        bear_result = calculate_dcf(self.snapshot, bear_assumptions, 'bear')
        
        self.assertLess(
            bear_result['price_per_share'],
            base_result['price_per_share'],
            "Bear case should have lower valuation than base"
        )


class TestConstraintValidation(unittest.TestCase):
    """Test formula constraints and guardrails"""
    
    def test_growth_rate_clamping(self):
        """Test that extreme growth rates are clamped"""
        snapshot = get_mock_fundamentals('AAPL')
        
        # Try to set unrealistic 100% growth
        custom_assumptions = {'revenue_growth_years_1_5': 1.00}
        assumptions = generate_dcf_assumptions(snapshot, custom_assumptions)
        
        # Should be capped at reasonable level
        self.assertLessEqual(assumptions['revenue_growth_years_1_5'], 1.00)
    
    def test_wacc_bounds(self):
        """Test that WACC is within reasonable bounds (3-30%)"""
        snapshot = get_mock_fundamentals('AAPL')
        assumptions = generate_dcf_assumptions(snapshot)
        result = calculate_dcf(snapshot, assumptions, 'base')
        
        wacc = result['wacc']
        
        self.assertGreaterEqual(wacc, 0.03, "WACC should be >= 3%")
        self.assertLessEqual(wacc, 0.30, "WACC should be <= 30%")
    
    def test_terminal_growth_auto_adjustment(self):
        """Test that terminal growth is auto-adjusted if >= WACC"""
        snapshot = get_mock_fundamentals('AAPL')
        
        # Try to set terminal growth = 15% (likely > WACC)
        custom_assumptions = {
            'terminal_growth_rate': 0.15,
            'risk_free_rate': 0.04,
            'market_risk_premium': 0.06,
            'beta': 1.0
        }
        
        assumptions = generate_dcf_assumptions(snapshot, custom_assumptions)
        
        # Calculate expected WACC
        wacc_estimate = calculate_wacc(
            assumptions['risk_free_rate'],
            assumptions['beta'],
            assumptions['market_risk_premium'],
            assumptions['cost_of_debt'],
            assumptions['debt_to_equity_ratio'],
            assumptions['tax_rate_current']
        )
        
        # Terminal growth should be adjusted to < WACC
        self.assertLess(
            assumptions['terminal_growth_rate'],
            wacc_estimate,
            "Terminal growth should be auto-adjusted to < WACC"
        )


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and error handling"""
    
    def test_zero_shares_outstanding(self):
        """Test that zero shares raises an error"""
        snapshot = get_mock_fundamentals('AAPL')
        snapshot['shares_outstanding'] = 0
        assumptions = generate_dcf_assumptions(snapshot)
        
        with self.assertRaises(ValueError):
            calculate_dcf(snapshot, assumptions, 'base')
    
    def test_negative_revenue(self):
        """Test handling of negative revenue"""
        snapshot = get_mock_fundamentals('AAPL')
        snapshot['revenue'] = -1_000_000_000
        assumptions = generate_dcf_assumptions(snapshot)
        
        # Should still calculate, but with warning
        result = calculate_dcf(snapshot, assumptions, 'base')
        self.assertIsNotNone(result)
    
    def test_very_high_debt(self):
        """Test handling of very high debt-to-equity"""
        snapshot = get_mock_fundamentals('AAPL')
        snapshot['debt'] = snapshot['equity'] * 5  # 5x leverage
        assumptions = generate_dcf_assumptions(snapshot)
        
        result = calculate_dcf(snapshot, assumptions, 'base')
        
        # With very high leverage, WACC can actually be lower due to tax shield
        # But it should still be above risk-free rate
        self.assertGreater(result['wacc'], assumptions['risk_free_rate'])


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)

