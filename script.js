// Constantes para cálculos fiscais
const SOCIAL_SECURITY_RATE_EMPLOYEE = 0.11; // 11% trabalhador
const SOCIAL_SECURITY_RATE_EMPLOYER = 0.2375; // 23.75% empresa

// Tabelas de IRS 2024 (exemplo simplificado)
const irsRates = {
    single: [
        { limit: 7479, rate: 0.145 },
        { limit: 11284, rate: 0.21 },
        { limit: 15992, rate: 0.265 },
        { limit: 20700, rate: 0.285 },
        { limit: 25200, rate: 0.35 },
        { limit: 36967, rate: 0.37 },
        { limit: 48033, rate: 0.435 },
        { limit: 75009, rate: 0.45 },
        { limit: Infinity, rate: 0.48 }
    ],
    married: [
        { limit: 7479 * 2, rate: 0.145 },
        { limit: 11284 * 2, rate: 0.21 },
        { limit: 15992 * 2, rate: 0.265 },
        { limit: 20700 * 2, rate: 0.285 },
        { limit: 25200 * 2, rate: 0.35 },
        { limit: 36967 * 2, rate: 0.37 },
        { limit: 48033 * 2, rate: 0.435 },
        { limit: 75009 * 2, rate: 0.45 },
        { limit: Infinity, rate: 0.48 }
    ]
};

// Deduções por dependente (valores 2024)
const dependentDeductions = {
    first: 500,
    second: 750,
    third: 1200,
    additional: 1200
};

// Constantes para subsídio de alimentação
const MEAL_ALLOWANCE_LIMITS = {
    card: 9.60,  // Limite diário isento para cartão refeição
    cash: 5.20   // Limite diário isento para pagamento em dinheiro
};

const DEFAULT_DAYS = 30; // Días naturais por mês
const MAX_MONTHLY_CARD = 288.00; // Máximo mensal em tarjeta (9.60€ × 30 dias)
const MAX_MONTHLY_CASH = 156.00; // Máximo mensal em efectivo (5.20€ × 30 dias)

// Constantes para IRS
const MINIMUM_SALARY = 820; // Salário mínimo 2024
const IRS_MINIMUM_THRESHOLD = 11784; // Limite mínimo para retenção IRS 2024

// Função para calcular Segurança Social do empregado
function calculateEmployeeSocialSecurity(grossSalary) {
    return grossSalary * SOCIAL_SECURITY_RATE_EMPLOYEE;
}

// Função para calcular Segurança Social da empresa
function calculateEmployerSocialSecurity(grossSalary) {
    return grossSalary * SOCIAL_SECURITY_RATE_EMPLOYER;
}

// Função para calcular a taxa mínima de retenção baseada na situação pessoal
function calculateMinimumRetention(personalData, annualIncome) {
    // Verificar se está abaixo do limite mínimo
    if (annualIncome <= 11784) {
        return 0; // Não há retenção mínima abaixo do limite
    }

    const baseRate = calculateBaseRetentionRate(annualIncome, personalData);
    let minRate = baseRate;

    // Ajustes baseados na situação pessoal
    if (personalData.dependents > 0) {
        minRate *= 0.95; // 5% redução por ter dependentes
    }
    if (personalData.deficiency === 'yes') {
        minRate *= 0.75; // 25% redução por deficiência
    }
    if (personalData.region === 'madeira') {
        minRate *= 0.8; // 20% redução para Madeira
    } else if (personalData.region === 'azores') {
        minRate *= 0.7; // 30% redução para Açores
    }

    return Math.max(minRate, 0);
}

// Função para calcular a taxa base de retenção
function calculateBaseRetentionRate(annualIncome, personalData) {
    const isMarried = personalData.maritalStatus.startsWith('married');
    const table = isMarried ? irsRates.married : irsRates.single;
    
    for (const bracket of table) {
        if (annualIncome <= bracket.limit) {
            return bracket.rate * 100; // Converter para percentagem
        }
    }
    return table[table.length - 1].rate * 100;
}

// Função para calcular o IRS
function calculateIRS(annualIncome, personalData) {
    // Verificar se o rendimento anual está abaixo do limite mínimo
    const minimumThreshold = 11784; // Limite mínimo para 2024
    if (annualIncome <= minimumThreshold) {
        return 0; // Não há retenção abaixo do limite mínimo
    }

    const customRetention = document.getElementById('customRetention').value;
    if (customRetention === 'custom') {
        const retentionPercentage = parseFloat(document.getElementById('retentionPercentage').value) || 0;
        const minRetention = calculateMinimumRetention(personalData, annualIncome);
        const actualRetention = Math.max(retentionPercentage, minRetention);
        return (annualIncome * (actualRetention / 100));
    }
    
    // Cálculo normal do IRS se não usar retenção personalizada
    let taxableIncome = annualIncome;
    
    // Ajuste por estado civil
    const rateTable = (personalData.maritalStatus.startsWith('married')) ? irsRates.married : irsRates.single;
    
    // Dedução por dependentes
    let dependentDeduction = 0;
    if (personalData.dependents > 0) {
        dependentDeduction += dependentDeductions.first;
        if (personalData.dependents > 1) {
            dependentDeduction += dependentDeductions.second;
        }
        if (personalData.dependents > 2) {
            dependentDeduction += dependentDeductions.third;
        }
        if (personalData.dependents > 3) {
            dependentDeduction += dependentDeductions.additional * (personalData.dependents - 3);
        }
    }
    taxableIncome -= dependentDeduction;

    // Ajuste por deficiência
    if (personalData.deficiency === 'yes') {
        taxableIncome *= 0.7; // 30% de redução
    }

    // Cálculo do IRS
    let tax = 0;
    let previousLimit = 0;

    for (const bracket of rateTable) {
        if (taxableIncome > previousLimit) {
            const taxableAmount = Math.min(taxableIncome - previousLimit, bracket.limit - previousLimit);
            tax += taxableAmount * bracket.rate;
        }
        if (taxableIncome <= bracket.limit) break;
        previousLimit = bracket.limit;
    }

    // Ajuste regional
    if (personalData.region === 'madeira') {
        tax *= 0.8; // 20% redução para Madeira
    } else if (personalData.region === 'azores') {
        tax *= 0.7; // 30% redução para Açores
    }

    return tax;
}

// Função para calcular contribuição necessária para pensão privada
function calculatePensionContribution(age) {
    let pensionLimit = 400;
    let deductionRate = 0.20; // 20% de dedução

    if (age > 50) pensionLimit = 300;
    else if (age >= 35) pensionLimit = 350;

    // Calcular quanto precisa contribuir para atingir o limite de dedução
    const requiredContribution = pensionLimit / deductionRate;
    
    return {
        maxDeduction: pensionLimit,
        requiredContribution: requiredContribution
    };
}

// Função para calcular benefícios do subsídio de alimentação
function calculateMealAllowance(dailyAmount, days, paymentMethod) {
    const monthlyTotal = Math.min(
        dailyAmount * days,
        paymentMethod === 'card' ? MAX_MONTHLY_CARD : MAX_MONTHLY_CASH
    );
    
    const monthlyExempt = monthlyTotal; // Todo es exento hasta el límite máximo mensual
    const monthlyTaxable = 0; // No hay parte tributable si respetamos los límites

    return {
        total: monthlyTotal,
        exempt: monthlyExempt,
        taxable: monthlyTaxable
    };
}

// Função para calcular deduções e mostrar recomendações
function calculateDeductions(dependents, mortgageInterest, healthExpenses, educationExpenses, age, mealAllowance, workDays, paymentMethod) {
    let totalDeductions = 0;
    let recommendations = [];

    // Dedução por dependente
    const dependentDeduction = dependents * 600;
    totalDeductions += dependentDeduction;
    if (dependents > 0) {
        recommendations.push(`✓ Benefício por dependentes: ${formatCurrency(dependentDeduction)} (${dependents} dependente${dependents > 1 ? 's' : ''})`);
    } else {
        recommendations.push('ℹ️ Não tem deduções por dependentes');
    }

    // Dedução de juros do crédito habitação
    const mortgageDeduction = Math.min(mortgageInterest * 0.15, 296);
    totalDeductions += mortgageDeduction;
    if (mortgageDeduction > 0) {
        recommendations.push(`✓ Dedução de crédito habitação: ${formatCurrency(mortgageDeduction)}`);
        if (mortgageDeduction < 296) {
            recommendations.push('💡 Pode aumentar a dedução do crédito habitação até ao limite de 296€');
        }
    }

    // Dedução de despesas de saúde
    const healthDeduction = Math.min(healthExpenses * 0.15, 1000);
    totalDeductions += healthDeduction;
    if (healthDeduction > 0) {
        recommendations.push(`✓ Dedução de saúde: ${formatCurrency(healthDeduction)}`);
        if (healthDeduction < 1000) {
            recommendations.push('💡 Pode aumentar as deduções de saúde até 1.000€');
        }
    }

    // Dedução de despesas de educação
    const educationDeduction = Math.min(educationExpenses * 0.30, 800);
    totalDeductions += educationDeduction;
    if (educationDeduction > 0) {
        recommendations.push(`✓ Dedução de educação: ${formatCurrency(educationDeduction)}`);
        if (educationDeduction < 800) {
            recommendations.push('💡 Pode aumentar as deduções de educação até 800€');
        }
    }

    // Calcular benefícios do subsídio de alimentação
    if (mealAllowance && workDays) {
        const mealBenefits = calculateMealAllowance(mealAllowance, workDays, paymentMethod);
        
        recommendations.push(`💳 Subsídio de Alimentação Mensal: ${formatCurrency(mealBenefits.total)}`);
        recommendations.push(`✓ Valor Isento: ${formatCurrency(mealBenefits.exempt)}`);
        
        if (mealBenefits.taxable > 0) {
            recommendations.push(`⚠️ Valor Tributável: ${formatCurrency(mealBenefits.taxable)}`);
            
            // Sugerir optimização se estiver a receber em dinheiro
            if (paymentMethod === 'cash' && mealAllowance > MEAL_ALLOWANCE_LIMITS.cash) {
                const potentialSavings = (mealAllowance - MEAL_ALLOWANCE_LIMITS.cash) * workDays;
                recommendations.push(`💡 Sugestão: Mudar para cartão refeição pouparia até ${formatCurrency(potentialSavings)} por mês em impostos`);
            }
        }

        // Mostrar limites
        recommendations.push(`ℹ️ Limites isentos: Cartão ${formatCurrency(MEAL_ALLOWANCE_LIMITS.card)}/dia, Dinheiro ${formatCurrency(MEAL_ALLOWANCE_LIMITS.cash)}/dia`);
    }

    // Recomendações de pensões privadas baseadas na idade
    const pension = calculatePensionContribution(age);
    recommendations.push(`💡 Para obter a dedução máxima de ${formatCurrency(pension.maxDeduction)}, precisa contribuir ${formatCurrency(pension.requiredContribution)} para uma pensão privada (baseado na sua idade)`);
    recommendations.push(`ℹ️ Esta dedução representa 20% do valor contribuído para a pensão privada`);

    return { totalDeductions, recommendations };
}

// Função para gerar recomendações baseadas nos dados
function generateRecommendations(data) {
    const recommendations = [];
    
    // Recomendações do subsídio de alimentação
    if (data.paymentMethod === 'cash' && data.mealAllowance > MEAL_ALLOWANCE_LIMITS.cash) {
        const potentialSavings = (data.mealAllowance - MEAL_ALLOWANCE_LIMITS.cash) * data.workDays;
        recommendations.push(`💡 Sugestão: Mudar para cartão refeição pouparia até ${formatCurrency(potentialSavings)} por mês em impostos`);
    }

    // Recomendações de pensão privada
    const pension = calculatePensionContribution(data.age);
    recommendations.push(`💰 Pensão Privada: Pode deduzir até ${formatCurrency(pension.maxDeduction)} por ano`);
    recommendations.push(`ℹ️ Para obter esta dedução máxima, precisa contribuir ${formatCurrency(pension.requiredContribution)} por ano`);

    // Recomendações gerais de benefícios fiscais
    recommendations.push('📋 Benefícios Fiscais Disponíveis:');
    recommendations.push('- Despesas de Saúde: Dedução de 15% até 1.000€');
    recommendations.push('- Despesas de Educação: Dedução de 30% até 800€');
    recommendations.push('- Crédito Habitação: Dedução de 15% dos juros até 296€');

    return recommendations;
}

// Função para análise do IRS
function analyzeIRS(annualIncome, annualIRS, monthlySS, paymentMonths) {
    const analysis = [];
    const annualSS = monthlySS * paymentMonths;
    const taxableIncome = annualIncome - annualSS;
    const monthlyIRS = annualIRS / paymentMonths;
    
    analysis.push(`📊 Rendimento Anual Bruto: ${formatCurrency(annualIncome)} (${paymentMonths} pagas)`);
    analysis.push(`💶 Segurança Social Anual: ${formatCurrency(annualSS)}`);
    analysis.push(`📈 Base Tributável: ${formatCurrency(taxableIncome)}`);
    
    if (annualIncome <= IRS_MINIMUM_THRESHOLD) {
        analysis.push('✅ Rendimento abaixo do limite mínimo para retenção de IRS');
        analysis.push(`💡 Salários até ${formatCurrency(IRS_MINIMUM_THRESHOLD)} anuais estão isentos de retenção na fonte`);
    } else {
        const effectiveRate = (annualIRS / annualIncome) * 100;
        analysis.push(`📊 Taxa Efetiva de IRS: ${effectiveRate.toFixed(1)}%`);
        analysis.push(`💰 IRS mensal estimado: ${formatCurrency(monthlyIRS)}`);
    }
    
    analysis.push(`ℹ️ Valores distribuídos em ${paymentMonths} pagas${paymentMonths === 14 ? ' (incluindo subsídios de férias e Natal)' : ''}`);
    analysis.push('ℹ️ Valores baseados nas tabelas de 2024');

    return analysis;
}

// Função para formatar valores monetários
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Lista de todos los toggles y sus secciones correspondientes
    const toggles = {
        'hasDependents': 'dependentsSection',
        'hasOtherIncome': 'otherIncomeSection',
        'hasMealAllowance': 'mealAllowanceSection',
        'hasMortgage': 'mortgageSection',
        'hasHealthExpenses': 'healthSection',
        'hasEducationExpenses': 'educationSection'
    };

    // Configurar cada toggle
    for (let toggleId in toggles) {
        const toggle = document.getElementById(toggleId);
        const section = document.getElementById(toggles[toggleId]);
        
        if (toggle && section) {
            // Establecer estado inicial
            section.style.display = toggle.checked ? 'block' : 'none';
            
            // Agregar event listener
            toggle.addEventListener('change', function() {
                if (this.checked) {
                    section.style.display = 'block';
                    // Animar la apertura
                    section.style.animation = 'none';
                    section.offsetHeight; // Trigger reflow
                    section.style.animation = 'slideDown 0.3s ease-out';
                } else {
                    section.style.display = 'none';
                    // Limpiar los campos cuando se oculta la sección
                    const inputs = section.querySelectorAll('input');
                    inputs.forEach(input => {
                        input.value = '';
                    });
                }
                // Actualizar cálculos
                document.querySelector('.calculate-btn').click();
            });
        }
    }
});

document.getElementById('salaryForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // Recolher dados
    const data = {
        grossSalary: parseFloat(document.getElementById('grossSalary').value) || 0,
        age: parseInt(document.getElementById('age').value) || 30,
        workDays: parseInt(document.getElementById('workDays').value) || DEFAULT_DAYS,
        mealAllowance: parseFloat(document.getElementById('mealAllowance').value) || (MAX_MONTHLY_CARD / DEFAULT_DAYS),
        paymentMethod: document.getElementById('paymentMethod').value,
        paymentMonths: parseInt(document.getElementById('paymentMonths').value) || 14,
        maritalStatus: document.getElementById('maritalStatus').value,
        dependents: parseInt(document.getElementById('dependents').value) || 0,
        deficiency: document.getElementById('deficiency').value,
        region: document.getElementById('region').value
    };

    // Cálculos básicos
    const monthlySocialSecurity = calculateEmployeeSocialSecurity(data.grossSalary);
    const employerSocialSecurity = calculateEmployerSocialSecurity(data.grossSalary);
    const mealAllowanceCalc = calculateMealAllowance(data.mealAllowance, data.workDays, data.paymentMethod);
    
    // Cálculos anuais
    const annualGrossSalary = data.grossSalary * data.paymentMonths;
    const annualTaxableMealAllowance = mealAllowanceCalc.taxable * (data.paymentMonths === 14 ? 11 : 12);
    const taxableIncome = annualGrossSalary + annualTaxableMealAllowance;
    const annualIRS = calculateIRS(taxableIncome, data);
    const monthlyIRS = annualIRS / data.paymentMonths;

    // Cálculos finais
    const netSalaryWithoutIRS = data.grossSalary - monthlySocialSecurity;
    const netSalaryMonthly = data.grossSalary - monthlySocialSecurity - monthlyIRS;
    const totalMonthlyNet = netSalaryMonthly + mealAllowanceCalc.total;

    // Calcular percentagens do IRS
    const effectiveRate = (monthlyIRS / data.grossSalary) * 100;
    const legalMinRate = calculateMinimumRetention(data, annualGrossSalary);

    // Atualizar resultados básicos
    document.getElementById('grossSalaryDisplay').textContent = formatCurrency(data.grossSalary);
    document.getElementById('netSalaryWithoutIRS').textContent = formatCurrency(netSalaryWithoutIRS);
    document.getElementById('netSalaryMonthly').textContent = formatCurrency(netSalaryMonthly);
    document.getElementById('totalMonthlyNet').textContent = formatCurrency(totalMonthlyNet);
    document.getElementById('socialSecurity').textContent = formatCurrency(monthlySocialSecurity);
    document.getElementById('employerSocialSecurity').textContent = formatCurrency(employerSocialSecurity);
    document.getElementById('employerCost').textContent = formatCurrency(data.grossSalary + employerSocialSecurity + mealAllowanceCalc.total);
    
    // Atualizar valores do IRS
    document.getElementById('irs').textContent = formatCurrency(monthlyIRS);
    document.getElementById('irsRate').textContent = effectiveRate.toFixed(1);
    document.getElementById('legalRate').textContent = legalMinRate.toFixed(1);

    // Atualizar subsídio de alimentação
    document.getElementById('mealAllowanceTotal').textContent = formatCurrency(mealAllowanceCalc.total);
    document.getElementById('mealAllowanceExempt').textContent = formatCurrency(mealAllowanceCalc.exempt);
    document.getElementById('mealAllowanceTaxable').textContent = formatCurrency(mealAllowanceCalc.taxable);

    // Atualizar análise IRS anual
    document.getElementById('annualIncome').textContent = formatCurrency(annualGrossSalary);
    document.getElementById('annualIRS').textContent = formatCurrency(annualIRS);
    
    document.getElementById('irsAnalysis').innerHTML = analyzeIRS(annualGrossSalary, annualIRS, monthlySocialSecurity, data.paymentMonths)
        .map(text => `<p>${text}</p>`)
        .join('');
    
    // Atualizar recomendações
    document.getElementById('recommendations').innerHTML = generateRecommendations(data)
        .map(text => `<p>${text}</p>`)
        .join('');

    // Atualizar benefícios fiscais
    const benefits = calculateDeductions(data.dependents, 0, 0, 0, data.age, data.mealAllowance, data.workDays, data.paymentMethod);
    document.getElementById('taxBenefits').innerHTML = benefits.recommendations
        .map(text => `<p>${text}</p>`)
        .join('');
});

document.addEventListener('DOMContentLoaded', function() {
    // Establecer valores por defecto
    document.getElementById('workDays').value = DEFAULT_DAYS;
    document.getElementById('mealAllowance').value = (MAX_MONTHLY_CARD / DEFAULT_DAYS).toFixed(2);
    
    // Actualizar límites quando cambia o método de pagamento
    document.getElementById('paymentMethod').addEventListener('change', function() {
        const maxMonthly = this.value === 'card' ? MAX_MONTHLY_CARD : MAX_MONTHLY_CASH;
        const maxDaily = (maxMonthly / DEFAULT_DAYS).toFixed(2);
        document.getElementById('maxExemptValue').textContent = maxDaily + '€';
        document.getElementById('mealAllowance').value = maxDaily;
        document.getElementById('maxMonthlyValue').textContent = maxMonthly.toFixed(2) + '€';
    });
});

// Event listeners para a retenção voluntária
document.getElementById('customRetention')?.addEventListener('change', function() {
    const retentionAmount = document.querySelector('.retention-amount');
    if (this.value === 'custom') {
        retentionAmount.style.display = 'block';
        updateMinimumRetention();
    } else {
        retentionAmount.style.display = 'none';
    }
    updateCalculations();
});

document.getElementById('retentionPercentage')?.addEventListener('input', function() {
    const minRetention = parseFloat(document.getElementById('minimumRetention').textContent);
    const currentValue = parseFloat(this.value) || 0;
    
    if (currentValue < minRetention) {
        this.classList.add('retention-warning');
        // Mostrar mensaje de advertencia si no existe
        if (!document.querySelector('.retention-warning-text')) {
            const warningText = document.createElement('div');
            warningText.className = 'retention-warning-text';
            warningText.textContent = `A percentagem não pode ser inferior a ${minRetention}%`;
            this.parentNode.appendChild(warningText);
        }
    } else {
        this.classList.remove('retention-warning');
        const warningText = document.querySelector('.retention-warning-text');
        if (warningText) {
            warningText.remove();
        }
    }
    updateCalculations();
});

// Atualizar a taxa mínima quando os dados pessoais mudam
function updateMinimumRetention() {
    const data = getFormData();
    const annualIncome = data.grossSalary * data.paymentMonths;
    const minRetention = calculateMinimumRetention(data, annualIncome);
    document.getElementById('minimumRetention').textContent = minRetention.toFixed(1);
    
    // Atualizar o valor mínimo do input
    const retentionInput = document.getElementById('retentionPercentage');
    if (retentionInput) {
        retentionInput.min = minRetention;
        if (parseFloat(retentionInput.value) < minRetention) {
            retentionInput.value = minRetention;
        }
    }
}

// Atualização em tempo real dos campos
document.querySelectorAll('input, select').forEach(input => {
    // Actualizar cálculos quando cambia el valor
    input.addEventListener('input', () => {
        document.querySelector('.calculate-btn').click();
    });

    // Solo para campos numéricos: navegación con Enter
    if (input.type === 'number') {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const inputs = Array.from(document.querySelectorAll('input:not([type="checkbox"]), select'));
                const index = inputs.indexOf(input);
                if (index > -1 && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            }
        });
    }
});

// Control de navegación entre campos
document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('keydown', function(e) {
        // Solo manejar la tecla Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('input:not([type="checkbox"]), select'));
            const index = inputs.indexOf(this);
            if (index > -1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        }
    });
});

// Prevenir el salto automático entre campos
document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('keydown', function(e) {
        // Prevenir cualquier comportamiento automático
        if (e.key !== 'Enter') {
            e.stopPropagation();
            return;
        }
        
        // Solo permitir el salto al siguiente campo si se presiona Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('input:not([type="checkbox"]), select'));
            const index = inputs.indexOf(this);
            if (index > -1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        }
    });
});

// Pension Calculator
document.getElementById('calculatePensionBenefit')?.addEventListener('click', calculatePensionBenefit);

function calculatePensionBenefit() {
    const contribution = parseFloat(document.getElementById('pensionContribution').value) || 0;
    const currentTax = parseFloat(document.getElementById('currentTax').value) || 0;
    const age = parseInt(document.getElementById('age').value) || 35;

    // Calculate deduction percentage (20% of contribution)
    let deduction = contribution * 0.20;

    // Apply age-based limits
    let maxDeduction;
    if (age < 35) {
        maxDeduction = 400;
    } else if (age <= 50) {
        maxDeduction = 350;
    } else {
        maxDeduction = 300;
    }

    // Ensure deduction doesn't exceed maximum
    deduction = Math.min(deduction, maxDeduction);

    // Calculate new tax amount
    const newTax = Math.max(0, currentTax - deduction);
    const totalSaving = currentTax - newTax;

    // Update results
    document.getElementById('taxDeduction').textContent = deduction.toFixed(2) + ' €';
    document.getElementById('newTaxAmount').textContent = newTax.toFixed(2) + ' €';
    document.getElementById('totalSaving').textContent = totalSaving.toFixed(2) + ' €';
}
